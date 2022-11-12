/* eslint-disable no-console */
import {Peer} from 'peerjs';
import event from '../event';
import {set, setLookup} from '../state';
import logger from '../logger';
import initLookups from './lookups';

const {log} = logger('multiplayer');

const sessionData = {
	get id() {
		return (
			document.getElementById('session-id') &&
			document.getElementById('session-id').value
		);
	},
	set id(value) {
		document.getElementById('session-id').value = value;
	},

	/**
	 * Status is one of: 'Not Connected', 'Connecting...', 'Connected', 'Error'
	 */
	_status: 'Not Connected',
	get status() {
		return this._status;
	},
	set status(value) {
		this._status = value;
		document.getElementById('connection-status').innerText = value;
		refreshPassage();
	}
};
const peerData = {
	id: undefined
};

export function init() {
	initLookups(setLookup, {sessionData, peerData});

	document.addEventListener('DOMContentLoaded', () => {
		sessionData.id = '';
		document.getElementById('host-game').addEventListener('click', () => {
			sessionData.id = '';
			hostGame();
		});
		document.getElementById('join-game').addEventListener('click', () => {
			const sid = sessionData.id;

			if (sid) {
				joinGame(sid);
			} else {
				log('Failed to join session due to missing session id');
				sessionData.status = 'Error';
			}
		});
	});
}

function hostGame() {
	sessionData.status = 'Connecting...';
	const peer = new Peer();

	peer.on('error', err => {
		log('peer connection error: host');
		console.error(err);
		sessionData.status = 'Error';
	});
	peer.on('open', id => {
		sessionData.id = id;
		peerData.id = id;
		sessionData.status = 'Connected';
	});
	peer.on('connection', conn => {
		setupConnection(conn);
	});
}

function joinGame(sessionID) {
	sessionData.status = 'Connecting...';
	const peer = new Peer();

	peer.on('error', err => {
		log('peer connection error: join');
		console.error(err);
		sessionData.status = 'Error';
	});
	peer.on('open', id => {
		peerData.id = id;
		setupConnection(peer.connect(sessionID));
	});
}

function setupConnection(connection) {
	// Receive messages
	connection.on('data', data => {
		if (shouldSyncState(data.name)) {
			log('Syncing FROM another client...');
			log(
				`name: ${data.name}, previous: ${data.previous}, value: ${data.value}`
			);
			set(data.name, data.value, true);
		}
	});

	connection.on('open', () => {
		sessionData.status = 'Connected';

		// Send messages
		event.on('state-change', ({name, previous, value, isFromPeers}) => {
			if (!isFromPeers && shouldSyncState(name)) {
				log('Syncing TO other clients...');
				log(`name: ${name}, previous: ${previous}, value: ${value}`);
				connection.send({name, previous, value});
			}
		});
	});

	connection.on('error', err => {
		log('peer connection error: connection issue');
		console.error(err);
		sessionData.status = 'Error';
	});
}

function refreshPassage() {
	event.emit('state-change', {name: 'multiplayer-state', isFromPeers: true});
}

function shouldSyncState(name) {
	/**
	 * Syncing rules
	 * 1. If a variable should be synced across players, start the variable with '$'
	 *
	 * For example, if you store a key in a drawer and you want only one player to be able to pick it up,
	 * you'll have two variables: hasDrawerKey and $isDrawerKeyTaken. You'll set up a condition that the
	 * drawer key cannot be retrieved if $isDrawerKeyTaken is true, which gets set across all players when
	 * a player picks up the key (an event where hasDrawerKey and $isDrawerKeyTaken are both set to true)
	 */
	return name.charAt(0) === '$';
}
