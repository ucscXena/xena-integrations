/*eslint-env browser */
/*globals require: false, module: false */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var _ = require('ucsc-xena-client/dist/underscore_ext');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var Button = require('react-bootstrap/lib/Button');
var Badge = require('react-bootstrap/lib/Badge');
var Tooltip = require('react-bootstrap/lib/Tooltip');
var OverlayTrigger = require('react-bootstrap/lib/OverlayTrigger');
var DefaultTextInput = require('ucsc-xena-client/dist/views/DefaultTextInput');
var {RefGeneAnnotation} = require('ucsc-xena-client/dist/refGeneExons');
var ResizeOverlay = require('ucsc-xena-client/dist/views/ResizeOverlay');
var widgets = require('ucsc-xena-client/dist/columnWidgets');
var aboutDatasetMenu = require('ucsc-xena-client/dist/views/aboutDatasetMenu');
var spinner = require('ucsc-xena-client/dist/ajax-loader.gif');

var xenaRoot = 'https://genome-cancer.ucsc.edu/proj/site/xena';

// XXX move this?
function download([fields, rows]) {
	var txt = _.map([fields].concat(rows), row => row.join('\t')).join('\n');
	// use blob for bug in chrome: https://code.google.com/p/chromium/issues/detail?id=373182
	var url = URL.createObjectURL(new Blob([txt], { type: 'text/tsv' }));
	var a = document.createElement('a');
	var filename = 'xenaDownload.tsv';
	_.extend(a, { id: filename, download: filename, href: url });
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

var styles = {
	badge: {
		fontSize: '100%',
		// Fix the width so it doesn't change if the label changes. This is important
		// when resizing, because we (unfortunately) inspect the DOM to discover
		// the minimum width we need to draw the column controls. If the label changes
		// to a different character, the width will be different, and our minimum width
		// becomes invalid.
		width: 24
	},
	status: {
		pointerEvents: 'none',
		textAlign: 'center',
		zIndex: 1,
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		backgroundColor: 'rgba(255, 255, 255, 0.6)'
	},
	error: {
		textAlign: 'center',
		pointerEvents: 'all',
		cursor: 'pointer'
	},
	columnMenuToggle: {
		position: 'absolute',
		left: 0,
		top: 0,
		width: '100%',
		height: '100%'
	}
};

function getStatusView(status, onReload) {
	if (status === 'loading') {
		return (
			<div style={styles.status}>
				<img style={{textAlign: 'center'}} src={spinner}/>
			</div>);
	}
	if (status === 'error') {
		return (
			<div style={styles.status}>
				<span
					onClick={onReload}
					title='Error loading data. Click to reload.'
					style={styles.error}
					className='glyphicon glyphicon-warning-sign Sortable-handle'
					aria-hidden='true'/>
			</div>);
	}
	return null;
}

var Column = React.createClass({
	onResizeStop: function (size) {
		this.props.onResize(this.props.id, size);
	},
	onRemove: function () {
		this.props.onRemove(this.props.id);
	},
	onDownload: function () {
		download(this.refs.plot.download());
	},
	onViz: function () {
		this.props.onViz(this.props.id);
	},
	onKm: function () {
		this.props.onKm(this.props.id);
	},
	onMode: function (ev, newMode) {
		this.props.onMode(this.props.id, newMode);
	},
	onColumnLabel: function (value) {
		this.props.onColumnLabel(this.props.id, value);
	},
	onFieldLabel: function (value) {
		this.props.onFieldLabel(this.props.id, value);
	},
	onMuPit: function () {
		// Construct the url, which will be opened in new window
		let rows = _.getIn(this.props, ['data', 'req', 'rows']),
			uriList = _.uniq(_.map(rows, n => `${n.chr}:${n.start.toString()}`)).join(','),
			url = `http://mupit.icm.jhu.edu/?gm=${uriList}`;

		window.open(url);
	},
	onReload: function () {
		this.props.onReload(this.props.id);
	},
	getControlWidth: function () {
		var controlWidth = ReactDOM.findDOMNode(this.refs.controls).getBoundingClientRect().width,
			labelWidth = ReactDOM.findDOMNode(this.refs.label).getBoundingClientRect().width;
		return controlWidth + labelWidth;
	},
	render: function () {
		var {id, label, samples, column, index,
				zoom, data, datasetMeta, fieldFormat, sampleFormat, disableKM, onClick, tooltip} = this.props,
			{width, columnLabel, fieldLabel, user} = column,
			[kmDisabled, kmTitle] = disableKM(id),
			status = _.get(data, 'status'),
			// move this to state to generalize to other annotations.
			doRefGene = _.get(data, 'refGene'),
			sortHelp = <Tooltip className='xena'>Drag to change column order</Tooltip>,
			menuHelp = <Tooltip className='xena'>Column menu</Tooltip>,
			moveIcon = (
				<OverlayTrigger placement='top' overlay={sortHelp}>
					<span
						className="glyphicon glyphicon-resize-horizontal Sortable-handle"
						aria-hidden="true">
					</span>
				</OverlayTrigger>);

		return (
			<div className='Column' style={{width: width, position: 'relative'}}>
				<br/>
				{/* Using Dropdown instead of SplitButton so we can put a Tooltip on the caret. :-p */}
				<Dropdown ref='controls' bsSize='xsmall'>
					<Button componentClass='label'>
						{moveIcon}
					</Button>
					{/* If OverlayTrigger contains Dropdown.Toggle, the toggle doesn't work. So we invert the nesting and use a span to cover the trigger area. */}
					<Dropdown.Toggle componentClass='label'>
						<OverlayTrigger placement='top' overlay={menuHelp}>
							<span style={styles.columnMenuToggle}></span>
						</OverlayTrigger>
					</Dropdown.Toggle>
					<Dropdown.Menu>
						<MenuItem title={kmTitle} onSelect={this.onKm} disabled={kmDisabled}>Kaplan Meier Plot</MenuItem>
						<MenuItem onSelect={this.onDownload}>Download</MenuItem>
						{aboutDatasetMenu(datasetMeta(id), xenaRoot)}
					</Dropdown.Menu>
				</Dropdown>
				<Badge ref='label' style={styles.badge} className='pull-right'>{label}</Badge>
				<br/>
				<DefaultTextInput
					onChange={this.onColumnLabel}
					value={{default: columnLabel, user: user.columnLabel}} />
				<DefaultTextInput
					onChange={this.onFieldLabel}
					value={{default: fieldLabel, user: user.fieldLabel}} />
				<div style={{height: 20}}>
					{doRefGene ?
						<RefGeneAnnotation
							width={width}
							refGene={_.values(data.refGene)[0]}
							layout={column.layout}
							position={{gene: column.fields[0]}}/> : null}
				</div>

				<ResizeOverlay
					onResizeStop={this.onResizeStop}
					width={width}
					minWidth={this.getControlWidth}
					height={zoom.height}>

					<div style={{position: 'relative'}}>
						{widgets.column({ref: 'plot', id, column, data, index, zoom, samples, onClick, fieldFormat, sampleFormat, tooltip})}
						{getStatusView(status, this.onReload)}
					</div>
				</ResizeOverlay>
				{widgets.legend({column, data})}
			</div>
		);
	}
});

module.exports = Column;
