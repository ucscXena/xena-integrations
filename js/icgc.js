
/*eslint-env browser */
/*global require: false, module: false */

'use strict';

var _ = require('ucsc-xena-client/dist/underscore_ext');
var {fetchColumnData, fetchSamples} = require('ucsc-xena-client/dist/controllers/common');
var uuid = require('ucsc-xena-client/dist/uuid');
var {getColSpec} = require('ucsc-xena-client/dist/models/datasetJoins');
var {defaultColorClass} = require('ucsc-xena-client/dist/heatmapColors');
var GeneProbeEdit = require('ucsc-xena-client/dist/views/GeneProbeEdit');
var GeneEdit = require('ucsc-xena-client/dist/views/GeneEdit');
var PhenotypeEdit = require('ucsc-xena-client/dist/views/PhenotypeEdit');

var dsIDs = {
	mutation: '{"host":"https://icgc.xenahubs.net","name":"simple_somatic_mutation.open.donor.xena.hasRNASNV"}',
	expression: '{"host":"https://icgc.xenahubs.net","name":"exp_seq_donor_US_log2.RNASNV"}',
	phenotype: '{"host":"https://icgc.xenahubs.net","name":"donor.all_projects.phenotype.hasRNASNV"}'
};


function getCol(datasets, settings) {
	var colSpec = getColSpec([settings], datasets),
		dsID = settings.dsID,
		ds = datasets[dsID];
	return _.assoc(colSpec,
		'width', 100,
		'columnLabel', ds.label,
		'user', {columnLabel: ds.label, fieldLabel: colSpec.fieldLabel},
		'colorClass', defaultColorClass(ds),
		'assembly', ds.assembly,
		'dsID', dsID);
}

var expressionSpec = (datasets, gene) =>
	getCol(datasets, GeneProbeEdit.apply(null, {list: gene}, false, datasets[dsIDs.expression]));

var mutationSpec = (datasets, gene) =>
	getCol(datasets, GeneEdit.apply(null, {gene}, null, datasets[dsIDs.mutation]));

var phenotypeSpec = (datasets, features, feature) =>
	getCol(datasets, PhenotypeEdit.apply(features, {feature, dsID: dsIDs.phenotype}));

// wow, this is awful.
var getSpec = _.curry((datasets, features, {dsID, field}) => {
	if (dsID === dsIDs.expression) {
		return expressionSpec(datasets, field);
	}
	if (dsID === dsIDs.mutation) {
		return mutationSpec(datasets, field);
	} 
	return phenotypeSpec(datasets, features, field);
});

var phenotypes = ["_primary_disease"];

// XXX Assume no composites, just single cohort; no multiple-fields.
var getColumnFields = ({fieldSpecs: [{fields: [field], dsID}]}) => ({field, dsID});

var currentColumns = (columnOrder, columns) =>
	_.map(columnOrder, c => getColumnFields(columns[c]));

var requestedColumns = genes => [
	..._.map(genes, field => ({field, dsID: dsIDs.expression})),
	..._.map(genes, field => ({field, dsID: dsIDs.mutation})),
	..._.map(phenotypes, field => ({field, dsID: dsIDs.phenotype}))];

var deepDiff = (a, b) => {
	let as = _.map(a, x => JSON.stringify(x)),
		bs = _.map(b, x => JSON.stringify(x)),
		diff = _.difference(as, bs);
	return _.map(diff, x => JSON.parse(x));
};

function getOrder(colList, oldAndNewCols) {
	var keys = _.map(colList, x => JSON.stringify(x)),
		mapping = _.invert(_.fmap(oldAndNewCols, c => JSON.stringify(getColumnFields(c))));
	return _.map(keys, k => mapping[k]);
}

// Update columns, columnOrder, and data, retaining existing columns when appropriate.
function syncColumns(state, genes) {
	if (_.isEmpty(state.datasets) || _.isEmpty(state.features)) {
		return state;
	}
	var {columns, datasets, columnOrder, features} = state,
		rqCols = requestedColumns(genes),
		currCols = currentColumns(columnOrder, columns),
		toAdd = deepDiff(rqCols, currCols),
		toRemove = deepDiff(currCols, rqCols);

	if (_.isEmpty(toAdd) && _.isEmpty(toRemove)) {
		return state;
	}

	var colsToAdd = _.map(toAdd, getSpec(datasets, features)),
		newUUIDs = _.map(colsToAdd, uuid),
		oldAndNewCols = _.merge(columns, _.object(newUUIDs, colsToAdd)),
		newColumnOrder = getOrder(rqCols, oldAndNewCols),
		newColumns = _.pick(oldAndNewCols, newColumnOrder);

	return _.updateIn(
			_.merge(state, {
				columns: newColumns,
				columnOrder: newColumnOrder
			}),
			// drop unused data
			['data'], data => _.pick(data, newColumnOrder));
}

function setFilter(state, donors) {
	return _.assocIn(state, ['cohort', 0, 'sampleFilter'], donors);
}

var maxGenes = 3;
var controls = {
	icgc: (state, donors, genes) => {
		let newState = syncColumns(setFilter(_.merge(state, {genes}), donors),
				genes.slice(0, maxGenes));

		return _.reduce(
				_.difference(newState.columnOrder, state.columnOrder),
				(acc, id) => _.assocIn(acc, ['data', id, 'status'], 'loading'),
				newState);
	},
	'icgc-post!': (serverBus, state, newState) => {
		let {servers: {user}} = newState;
		if (!_.isEqual(state.cohort[0].sampleFilter, newState.cohort[0].sampleFilter)) {
			fetchSamples(serverBus, user, newState.cohort);
		}
		if (_.isEmpty(state.datasets)) {
			return;
		}
		_.difference(newState.columnOrder, state.columnOrder)
			.forEach(id => 
				fetchColumnData(serverBus, state.cohortSamples, id, _.getIn(newState, ['columns', id])));
	},
	datasets: state => syncColumns(state, state.genes.slice(0, maxGenes)),
	// We don't need a datsets-post! here to fetchColumnData, because we will
	// have run syncColumns before the main server datasets-post! runs, which
	// will run fetchColumnData for us.
	features: state => {
		var newState = syncColumns(state, state.genes.slice(0, maxGenes));
		return _.reduce(
				newState.columnOrder,
				(acc, id) => _.assocIn(acc, ['data', id, 'status'], 'loading'),
				newState);
	},
	// Issue fetchColumnData, since we just ran syncColumns.
	'features-post!': (serverBus, state, newState) => {
		let {columnOrder, cohortSamples, columns} = newState;
		columnOrder.forEach(
			id => fetchColumnData(serverBus, cohortSamples, id, columns[id]));
	}
};

var identity = x => x;
module.exports = {
	action: (state, [tag, ...args]) => (controls[tag] || identity)(state, ...args),
	postAction: (serverBus, state, newState, [tag, ...args]) => (controls[tag + '-post!'] || identity)(serverBus, state, newState, ...args)
};
