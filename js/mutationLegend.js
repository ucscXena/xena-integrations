/*global require: false, module: false */
'use strict';

var _ = require('ucsc-xena-client/dist/underscore_ext');
var Legend = require('ucsc-xena-client/dist/views/Legend');
var {features} = require('ucsc-xena-client/dist/models/mutationVector');
var widgets = require('ucsc-xena-client/dist/columnWidgets');
var React = require('react');

// Override default mutation legend.

function cutChromLabels({colors, labels, align}) {
	var retain = _.filterIndices(labels, l => !l.match(/^chr[0-9XYM]+/));
	return {
		colors: _.map(retain, i => colors[i]),
		labels: _.map(retain, i => labels[i]),
		align
	};
}

function drawLegend({column}) {
	var feature = _.getIn(column, ['sFeature']),
		{colors, labels, align} = cutChromLabels(features[feature].legend);
	return (
		<Legend
			colors={['rgb(255,255,255)', ...colors]}
			labels={['no variant', ...labels]}
			align={align}
			ellipsis='' />
	);
}

widgets.legend.add('mutation', drawLegend);
