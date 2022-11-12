/* eslint-disable no-console */
import {Peer} from 'peerjs';
import event from '../event';
import {set, setLookup} from '../state';
import logger from '../logger';

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
	}
};
const peerData = {
	id: undefined
};

export function init() {
	setLookup('session.id', () => {
		return sessionData.id;
	});

	setLookup('peer.id', () => {
		return peerData.id;
	});
	setLookup('peer.isHost', () => {
		return peerData.id === sessionData.id;
	});
	setLookup('peer.isGuest', () => {
		return peerData.id !== sessionData.id;
	});

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
				setConnectionStatus('Error');
			}
		});
	});
}

function setConnectionStatus(status) {
	document.getElementById('connection-status').innerHTML = status;
}

function hostGame() {
	setConnectionStatus('Connecting...');
	const peer = new Peer();

	peer.on('error', err => {
		log('peer connection error: host');
		console.error(err);
		setConnectionStatus('Error');
	});
	peer.on('open', id => {
		sessionData.id = id;
		peerData.id = id;
		setConnectionStatus('Connected');
	});
	peer.on('connection', conn => {
		setupConnection(conn);
	});
}

function joinGame(sessionID) {
	setConnectionStatus('Connecting...');
	const peer = new Peer();

	peer.on('error', err => {
		log('peer connection error: join');
		console.error(err);
		setConnectionStatus('Error');
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
		setConnectionStatus('Connected');

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
		setConnectionStatus('Error');
	});
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
