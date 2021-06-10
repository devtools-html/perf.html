/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

import React, { PureComponent } from 'react';
import { withSize } from 'firefox-profiler/components/shared/WithSize';
import { VerticalIndicators } from './VerticalIndicators';

import {
  getCommittedRange,
  getZeroAt,
  getPageList,
} from 'firefox-profiler/selectors/profile';
import { getThreadSelectors } from 'firefox-profiler/selectors/per-thread';
import {
  TRACK_NETWORK_ROW_HEIGHT,
  TRACK_NETWORK_ROW_REPEAT,
  TRACK_NETWORK_HEIGHT,
} from 'firefox-profiler/app-logic/constants';
import explicitConnect from 'firefox-profiler/utils/connect';
import { bisectionRight } from 'firefox-profiler/utils/bisect';

import type {
  CssPixels,
  ThreadIndex,
  PageList,
  Marker,
  MarkerIndex,
  MarkerTiming,
  Milliseconds,
} from 'firefox-profiler/types';

import type { SizeProps } from 'firefox-profiler/components/shared/WithSize';
import type { ConnectedProps } from 'firefox-profiler/utils/connect';

import './TrackNetwork.css';

/**
 * When adding properties to these props, please consider the comment above the component.
 */
type CanvasProps = {|
  +rangeStart: Milliseconds,
  +rangeEnd: Milliseconds,
  +width: CssPixels,
  +networkTiming: MarkerTiming[],
  +onHoveredMarkerChange: (
    hoveredMarkerIndex: MarkerIndex | null,
    mouseX?: CssPixels,
    mouseY?: CssPixels
  ) => mixed,
|};

/**
 * This component controls the rendering of the canvas. Every render call through
 * React triggers a new canvas render. Because of this, it's important to only pass
 * in the props that are needed for the canvas draw call.
 */
class NetworkCanvas extends PureComponent<CanvasProps> {
  _requestedAnimationFrame: boolean = false;
  _canvas = React.createRef<HTMLCanvasElement>();

  _hitTest(e: SyntheticMouseEvent<>): MarkerIndex | null {
    const { rangeStart, rangeEnd, networkTiming, width } = this.props;
    // React's Synthetic event doesn't have these properties, but the native event does.
    const { offsetX: x, offsetY: y } = e.nativeEvent;

    const row = Math.floor(y / TRACK_NETWORK_ROW_HEIGHT);
    const rangeLength = rangeEnd - rangeStart;
    const time = rangeStart + (x / width) * rangeLength;

    // Row i matches network timing's rows i, i + TRACK_NETWORK_ROW_REPEAT, i + TRACK_NETWORK_ROW_REPEAT * 2, etc
    // In each of these row, there can be either 0 or 1 marker that contains
    // this time. We want to keep the marker that's the closest to the time, and
    // these 2 variables will help us with that.
    let closestMarkerIndex = null;
    let closestMarkerStart = -Infinity;
    for (let i = row; i < networkTiming.length; i += TRACK_NETWORK_ROW_REPEAT) {
      const timingRow = networkTiming[i];

      // Bisection returns the index where we would insert the element.
      // Therefore the previous index is where the closest smaller start is,
      // that's the only one in this row that could contain this time.
      const indexInRow = bisectionRight(timingRow.start, time) - 1;

      if (indexInRow < 0) {
        // All markers on this row are after this time.
        continue;
      }

      const start = timingRow.start[indexInRow];
      const end = timingRow.end[indexInRow];

      if (end < time) {
        // The marker we found ends before this time.
        continue;
      }

      if (start > closestMarkerStart) {
        closestMarkerStart = start;
        closestMarkerIndex = timingRow.index[indexInRow];
      }
    }

    return closestMarkerIndex;
  }

  _onMouseLeave = () => {
    this.props.onHoveredMarkerChange(null);
  };

  _onMouseMove = (e: SyntheticMouseEvent<>) => {
    const hoveredMarkerIndex = this._hitTest(e);
    this.props.onHoveredMarkerChange(hoveredMarkerIndex, e.pageX, e.pageY);
  };

  _scheduleDraw() {
    if (!this._requestedAnimationFrame) {
      this._requestedAnimationFrame = true;
      window.requestAnimationFrame(() => {
        this._requestedAnimationFrame = false;
        const canvas = this._canvas.current;
        if (canvas) {
          this.drawCanvas(canvas);
        }
      });
    }
  }

  drawCanvas(canvas: HTMLCanvasElement) {
    const {
      rangeStart,
      rangeEnd,
      networkTiming,
      width: containerWidth,
    } = this.props;

    const rangeLength = rangeEnd - rangeStart;

    const devicePixelRatio = window.devicePixelRatio;
    const rowHeight = TRACK_NETWORK_ROW_HEIGHT * devicePixelRatio;
    canvas.width = Math.round(containerWidth * devicePixelRatio);
    canvas.height = Math.round(TRACK_NETWORK_HEIGHT * devicePixelRatio);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 127, 255, 0.3)';

    ctx.lineCap = 'round';
    ctx.lineWidth = rowHeight * 0.75;
    for (let rowIndex = 0; rowIndex < networkTiming.length; rowIndex++) {
      const timing = networkTiming[rowIndex];
      for (let timingIndex = 0; timingIndex < timing.length; timingIndex++) {
        const start =
          (canvas.width / rangeLength) *
          (timing.start[timingIndex] - rangeStart);
        const end =
          (canvas.width / rangeLength) * (timing.end[timingIndex] - rangeStart);
        const y =
          (rowIndex % TRACK_NETWORK_ROW_REPEAT) * rowHeight + rowHeight * 0.5;
        ctx.beginPath();
        ctx.moveTo(start, y);
        ctx.lineTo(end, y);
        ctx.stroke();
      }
    }
  }

  render() {
    this._scheduleDraw();
    return (
      <canvas
        className="timelineTrackNetworkCanvas"
        ref={this._canvas}
        onMouseMove={this._onMouseMove}
        onMouseLeave={this._onMouseLeave}
      />
    );
  }
}

type OwnProps = {|
  +threadIndex: ThreadIndex,
|};

type StateProps = {|
  +pages: PageList | null,
  +rangeStart: Milliseconds,
  +rangeEnd: Milliseconds,
  +zeroAt: Milliseconds,
  +getMarker: MarkerIndex => Marker,
  +networkTiming: MarkerTiming[],
  +verticalMarkerIndexes: MarkerIndex[],
|};
type DispatchProps = {||};
type Props = {|
  ...ConnectedProps<OwnProps, StateProps, DispatchProps>,
  ...SizeProps,
|};
type State = {|
  +hoveredMarkerIndex: MarkerIndex | null,
|};

class Network extends PureComponent<Props, State> {
  state = { hoveredMarkerIndex: null };

  _onHoveredMarkerChange = (hoveredMarkerIndex: MarkerIndex | null) => {
    if (hoveredMarkerIndex === null) {
      if (!window.persistTooltips) {
        // This persistTooltips property is part of the web console API. It helps
        // in being able to inspect and debug tooltips.
        this.setState({
          hoveredMarkerIndex: null,
        });
      }
    } else {
      this.setState({ hoveredMarkerIndex });
    }
  };

  render() {
    const {
      pages,
      rangeStart,
      rangeEnd,
      getMarker,
      verticalMarkerIndexes,
      zeroAt,
      networkTiming,
      width: containerWidth,
    } = this.props;

    return (
      <div
        className="timelineTrackNetwork"
        style={{
          height: TRACK_NETWORK_HEIGHT,
        }}
      >
        <NetworkCanvas
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          networkTiming={networkTiming}
          width={containerWidth}
          onHoveredMarkerChange={this._onHoveredMarkerChange}
        />
        <VerticalIndicators
          verticalMarkerIndexes={verticalMarkerIndexes}
          getMarker={getMarker}
          pages={pages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          zeroAt={zeroAt}
          width={containerWidth}
        />
      </div>
    );
  }
}

export const TrackNetwork = explicitConnect<
  OwnProps,
  StateProps,
  DispatchProps
>({
  mapStateToProps: (state, ownProps) => {
    const { threadIndex } = ownProps;
    const selectors = getThreadSelectors(threadIndex);
    const { start, end } = getCommittedRange(state);
    const networkTiming = selectors.getNetworkTrackTiming(state);
    return {
      getMarker: selectors.getMarkerGetter(state),
      pages: getPageList(state),
      networkTiming: networkTiming,
      rangeStart: start,
      rangeEnd: end,
      zeroAt: getZeroAt(state),
      verticalMarkerIndexes: selectors.getTimelineVerticalMarkerIndexes(state),
    };
  },
  component: withSize<Props>(Network),
});
