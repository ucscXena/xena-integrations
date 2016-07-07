/*eslint-env browser */
/*global require: false, module: false */

'use strict';

require('babel-polyfill');

var _ = require('ucsc-xena-client/underscore_ext');
require('ucsc-xena-client/plotDenseMatrix');
require('ucsc-xena-client/plotMutationVector');
require('./mutationLegend');
require('ucsc-xena-client/models/denseMatrix');
require('ucsc-xena-client/models/mutationVector');
var uiController = require('ucsc-xena-client/controllers/ui');
var serverController = require('ucsc-xena-client/controllers/server');
var icgcController = require('ucsc-xena-client/controllers/icgc');
require('bootstrap/dist/css/bootstrap.css');
var Application = require('./ApplicationContainer');
var selector = require('ucsc-xena-client/appSelector');
var compose = require('ucsc-xena-client/controllers/compose');
const connector = require('ucsc-xena-client/connector');
const createStore = require('ucsc-xena-client/store');

// Hot load controllers. Note that hot loading won't work if one of the methods
// is captured in a closure or variable which we can't access.  References to
// the controller methods should only happen by dereferencing the module. That's
// currently true of the controllers/compose method, so we are able to hot
// load by overwritting the methods, here. However it's not true of devtools.
// If we had a single controller (i.e. no call to compose), passing a single
// controller to devtools would defeat the hot loading. Sol'n would be to
// update devtools to always dereference the controller, rather than keeping
// methods in closures.
// Rx streams in components are also a problem.

if (module.hot) {
	module.hot.accept('../controllers/ui', () => {
		var newModule = require('../controllers/ui');
		_.extend(uiController, newModule);
	});
	module.hot.accept('../controllers/server', () => {
		var newModule = require('../controllers/server');
		_.extend(serverController, newModule);
	});
	module.hot.accept('../controllers/icgc', () => {
		var newModule = require('../controllers/icgc');
		_.extend(icgcController, newModule);
	});
	// XXX Note that hot-loading these won't cause a re-render.
	module.hot.accept('../models/mutationVector', () => {});
	module.hot.accept('../models/denseMatrix', () => {});
}

var cohort = 'ICGC (US RNA and SNV)';
var store = _.updateIn(createStore(), ['initialState'], s =>
		_.assoc(s,
			'cohortPending', [{name: cohort}],
			'genes', []));

// icgcController appears last here so that 'datasets' and 'features'
// methods have the datasets or features in state prior to trying to
// syncColumns. We could, alternatively, parameterize syncColumns to
// pass in 'datasets' and 'features'.
var controller = compose(icgcController, serverController, uiController);

module.exports = {
	updater: ac => store.uiCh.onNext(ac),
	start: (function () {
		// Working around angular changing our div out from under us.
		var dom;
		return main => {
			if (dom) {
				dom.main = main;
				store.uiCh.onNext(['redraw']);
			} else {
				dom = connector({...store, controller, main, selector, Page: Application});
			}
		};
	})()
};
