/*
Multiplayer related lookups.
*/

export default function init(setLookup, {peerData, sessionData}) {
	setLookup('multiplayer.session.id', () => {
		return sessionData.id;
	});
	setLookup('multiplayer.session.status', () => {
		return sessionData.status;
	});
	setLookup('multiplayer.session.isConnected', () => {
		return sessionData.status === 'Connected';
	});

	setLookup('multiplayer.peer.id', () => {
		return peerData.id || '';
	});
	setLookup('multiplayer.peer.isHost', () => {
		return peerData.id === sessionData.id;
	});
	setLookup('multiplayer.peer.isGuest', () => {
		return peerData.id !== sessionData.id;
	});
}