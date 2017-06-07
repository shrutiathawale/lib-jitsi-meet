import * as JitsiConferenceEvents from '../JitsiConferenceEvents';

/**
 * The <tt>P2PDominantSpeakerDetection</tt> is activated only when p2p is
 * currently used.
 * Listens for changes in the audio level changes of the local p2p audio track
 * or remote p2p one and fires dominant speaker events to be able to use
 * features depending on those events (speaker stats), to make them work without
 * the video bridge.
 */
export default class P2PDominantSpeakerDetection {
    /**
     * Creates P2PDominantSpeakerDetection
     * @param conference the JitsiConference instance that created us.
     * @constructor
     */
    constructor(conference) {
        this.conference = conference;

        this._audioLevel = this._audioLevel.bind(this);
        this._onP2PChanged = this._onP2PChanged.bind(this);
        this._trackAdded = this._trackAdded.bind(this);

        conference.addEventListener(
            JitsiConferenceEvents.P2P_STATUS, this._onP2PChanged);
    }

    /**
     * Notified when p2p state changes for current conference.
     *
     * @param {JitsiConference} conference - the current conference
     * @param {bool} isP2P - are we going in p2p mode or exiting that mode
     * @private
     */
    _onP2PChanged(conference, isP2P) {
        if (isP2P) {
            conference.addEventListener(
                JitsiConferenceEvents.TRACK_ADDED,
                this._trackAdded);
            conference.statistics.addAudioLevelListener(this._audioLevel);
        } else {
            conference.statistics.removeAudioLevelListener(this._audioLevel);
            conference.removeEventListener(
                JitsiConferenceEvents.TRACK_ADDED,
                this._trackAdded);
        }
    }

    /* eslint-disable max-params */
    /**
     * Receives audio level events for all send and receive streams.
     *
     * @param pc - WebRTC PeerConnection object of the
     * @param ssrc - The synchronization source identifier (SSRC) of the
     * endpoint/participant/stream being reported.
     * @param {number} audioLevel - The audio level of <tt>ssrc</tt>.
     * @param {boolean} isLocal - <tt>true</tt> if <tt>ssrc</tt> represents a
     * local/send stream or <tt>false</tt> for a remote/receive stream.
     */
    _audioLevel(pc, ssrc, audioLevel, isLocal) {

        // if audio level is lower than this we consider noise and no one is
        // talking. The same value is used in TalkMutedDetection
        if (audioLevel <= 0.6) {
            return;
        }

        const track = pc.getTrackBySSRC(ssrc);

        // no such track
        if (!track) {
            return;
        }

        // local p2p track which is not muted
        // or if the ssrc is for the remote audio p2p track
        if ((isLocal && pc.isP2P && !track.isMuted())
            || ssrc === this.remoteAudioTrackSSRC) {
            this.conference.eventEmitter.emit(
                JitsiConferenceEvents.DOMINANT_SPEAKER_CHANGED,
                track.getParticipantId());
        }
    }
    /* eslint-enable max-params */

    /**
     * Notifies this <tt>P2PDominantSpeakerDetection</tt> that
     * a {@link JitsiTrack} was added to the associated {@link JitsiConference}.
     * Looks for the p2p remote audio track only.
     *
     * @param {JitsiTrack} track - The added <tt>JitsiTrack</tt>.
     * @private
     */
    _trackAdded(track) {
        if (track.isP2P && track.isAudioTrack() && !track.isLocal()) {
            this.remoteAudioTrackSSRC = track.ssrc;
        }
    }
}
