/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

import React, { PureComponent } from 'react';
import classNames from 'classnames';
import {
  changeRightClickedTrack,
  selectTrack,
} from '../../actions/profile-view';
import { assertExhaustiveCheck } from '../../utils/flow';
import ContextMenuTrigger from '../shared/ContextMenuTrigger';
import {
  getSelectedThreadIndex,
  getHiddenLocalTracks,
  getSelectedTab,
} from '../../selectors/url-state';
import explicitConnect from '../../utils/connect';
import {
  getLocalTrackName,
  getCounterSelectors,
} from '../../selectors/profile';
import { getThreadSelectors } from '../../selectors/per-thread';
import TrackThread from './TrackThread';
import TrackNetwork from './TrackNetwork';
import { TrackMemory } from './TrackMemory';
import { TrackOverhead } from './TrackOverhead';
import { getOverheadTypeStrings } from '../../profile-logic/tracks';
import type { TrackReference } from '../../types/actions';
import type { Pid } from '../../types/profile';
import type { TrackIndex, LocalTrack } from '../../types/profile-derived';
import type { ConnectedProps } from '../../utils/connect';

type OwnProps = {|
  +pid: Pid,
  +localTrack: LocalTrack,
  +trackIndex: TrackIndex,
  +style?: Object /* This is used by Reorderable */,
|};

type StateProps = {|
  +trackName: string,
  +isSelected: boolean,
  +isHidden: boolean,
  +titleText: string | null,
|};

type DispatchProps = {|
  +changeRightClickedTrack: typeof changeRightClickedTrack,
  +selectTrack: typeof selectTrack,
|};

type Props = ConnectedProps<OwnProps, StateProps, DispatchProps>;

class LocalTrackComponent extends PureComponent<Props> {
  _onLabelMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      // Don't allow clicks on the threads list to steal focus from the tree view.
      event.preventDefault();
      this._onLineClick();
    } else if (event.button === 2) {
      // This is needed to allow the context menu to know what was right clicked without
      // actually changing the current selection.
      this.props.changeRightClickedTrack(this._getTrackReference());
    }
  };

  _getTrackReference(): TrackReference {
    const { pid, trackIndex } = this.props;
    return { type: 'local', pid, trackIndex };
  }

  _onLineClick = () => {
    this.props.selectTrack(this._getTrackReference());
  };

  renderTrack() {
    const { localTrack } = this.props;
    switch (localTrack.type) {
      case 'thread':
        return <TrackThread threadIndex={localTrack.threadIndex} />;
      case 'network':
        return <TrackNetwork threadIndex={localTrack.threadIndex} />;
      case 'memory':
        return <TrackMemory counterIndex={localTrack.counterIndex} />;
      case 'overhead':
        return (
          <TrackOverhead
            overheadIndex={localTrack.overheadIndex}
            overheadType={localTrack.overheadType}
          />
        );
      default:
        console.error('Unhandled localTrack type', (localTrack: empty)); // TODO: change to exhaustive check
        return null;
    }
  }

  render() {
    const { isSelected, isHidden, titleText, trackName, style } = this.props;

    if (isHidden) {
      // If this global track is hidden, render out a stub element so that the
      // Reorderable Component still works across all the tracks.
      return <li className="timelineTrackHidden" />;
    }

    return (
      <li className="timelineTrack timelineTrackLocal" style={style}>
        {/* This next div is used to mirror the structure of the TimelineGlobalTrack */}
        <div
          className={classNames('timelineTrackRow timelineTrackLocalRow', {
            selected: isSelected,
          })}
          onClick={this._onLineClick}
        >
          <ContextMenuTrigger
            id="TimelineTrackContextMenu"
            renderTag="div"
            attributes={{
              title: titleText,
              className:
                'timelineTrackLabel timelineTrackLocalLabel timelineTrackLocalGrippy',
              onMouseDown: this._onLabelMouseDown,
            }}
          >
            <button type="button" className="timelineTrackNameButton">
              {trackName}
            </button>
          </ContextMenuTrigger>
          <div className="timelineTrackTrack">{this.renderTrack()}</div>
        </div>
      </li>
    );
  }
}

export default explicitConnect<OwnProps, StateProps, DispatchProps>({
  mapStateToProps: (state, { pid, localTrack, trackIndex }) => {
    // These get assigned based on the track type.
    let titleText = null;
    let isSelected = false;

    // Run different selectors based on the track type.
    switch (localTrack.type) {
      case 'thread': {
        // Look up the thread information for the process if it exists.
        const threadIndex = localTrack.threadIndex;
        const selectedThreadIndex = getSelectedThreadIndex(state);
        const selectedTab = getSelectedTab(state);
        const selectors = getThreadSelectors(threadIndex);
        isSelected =
          threadIndex === selectedThreadIndex &&
          selectedTab !== 'network-chart';
        titleText = selectors.getThreadProcessDetails(state);
        break;
      }
      case 'network': {
        const threadIndex = localTrack.threadIndex;
        const selectedThreadIndex = getSelectedThreadIndex(state);
        const selectedTab = getSelectedTab(state);
        isSelected =
          threadIndex === selectedThreadIndex &&
          selectedTab === 'network-chart';
        break;
      }
      case 'memory': {
        titleText = getCounterSelectors(localTrack.counterIndex).getDescription(
          state
        );
        break;
      }
      case 'overhead': {
        titleText =
          getOverheadTypeStrings(localTrack.overheadType).name + ' Overhead';
        break;
      }
      default:
        throw assertExhaustiveCheck(localTrack, `Unhandled LocalTrack type.`);
    }

    return {
      trackName: getLocalTrackName(state, pid, trackIndex),
      titleText,
      isSelected,
      isHidden: getHiddenLocalTracks(state, pid).has(trackIndex),
    };
  },
  mapDispatchToProps: {
    changeRightClickedTrack,
    selectTrack,
  },
  component: LocalTrackComponent,
});
