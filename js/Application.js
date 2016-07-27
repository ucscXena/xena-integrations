/*global require: false, module: false, window: false */
/*eslint-env browser */
'use strict';
var React = require('react');
var Grid = require('react-bootstrap/lib/Grid');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Button = require('react-bootstrap/lib/Button');
var KmPlot = require('ucsc-xena-client/dist/KmPlot');
var _ = require('ucsc-xena-client/dist/underscore_ext');
require('./Application.css');

var Application = React.createClass({
	sendState(event) {
		if (event.data.type === 'xenaRequestState') {
			event.source.postMessage(this.props.state, "*");
		}
		window.removeEventListener('message', this.sendState);
	},
	onXena() {
		window.addEventListener('message', this.sendState);
		window.open('https://genome-cancer.ucsc.edu/proj/site/xena/heatmap/?inline');
	},
	render: function() {
		let {state, children} = this.props;

		return (
			<Grid onClick={this.onClick}>
				<Row>
					<Col md={2}>
						<Button onClick={this.onXena}>Open in Xena</Button>
					</Col>
				</Row>
				{children}
				{_.getIn(state, ['km', 'id']) ? <KmPlot
						callback={this.props.callback}
						km={state.km}
						features={state.features} /> : null}
			</Grid>
		);
	}
});

module.exports = Application;
