/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @flow

import { storeWithProfile } from '../fixtures/stores';
import * as ProfileViewSelectors from '../../reducers/profile-view';
import * as UrlStateSelectors from '../../reducers/url-state';

import {
  changeCallTreeSearchString,
  changeHidePlatformDetails,
  addRangeFilter,
  changeInvertCallstack,
  updateProfileSelection,
  changeImplementationFilter,
} from '../../actions/profile-view';
import { changeStackChartColorStrategy } from '../../actions/stack-chart';
import { getCategoryByImplementation } from '../../profile-logic/color-categories';
import { getProfileFromTextSamples } from '../fixtures/profiles/make-profile';

const { selectedThreadSelectors } = ProfileViewSelectors;

describe('selectors/getStackTimingByDepthForStackChart', function() {
  /**
   * This table shows off how a stack chart gets filtered to JS only, where the number is
   * the stack index, and P is platform code, and J javascript.
   *
   *            Unfiltered             ->             JS Only
   *   0-10-20-30-40-50-60-70-80-90-91      0-10-20-30-40-50-60-70-80-90-91 <- Timing (ms)
   *  ================================     ================================
   *  0P 0P 0P 0P 0P 0P 0P 0P 0P 0P  |     0P 0P 0P 0P 0P 0P 0P 0P 0P 0P  |
   *  1P 1P 1P 1P    1P 1P 1P 1P 1P  |                       1J 1J 1J 1J  |
   *     2P 2P 3P       4J 4J 4J 4J  |                          2J 2J     |
   *                       5J 5J     |                             3P     |
   *                          6P     |                             4J     |
   *                          7P     |
   *                          8J     |
   */

  it('computes unfiltered stack timing by depth', function() {
    const store = storeWithProfile();
    const stackTimingByDepth = selectedThreadSelectors.getStackTimingByDepthForStackChart(
      store.getState()
    );
    expect(stackTimingByDepth).toEqual([
      { start: [0], end: [91], stack: [0], length: 1 },
      { start: [0, 50], end: [40, 91], stack: [1, 1], length: 2 },
      { start: [10, 30, 60], end: [30, 40, 91], stack: [2, 3, 4], length: 3 },
      { start: [70], end: [90], stack: [5], length: 1 },
      { start: [80], end: [90], stack: [6], length: 1 },
      { start: [80], end: [90], stack: [7], length: 1 },
      { start: [80], end: [90], stack: [8], length: 1 },
    ]);
  });

  it('computes "Hide platform details" stack timing by depth', function() {
    const store = storeWithProfile();
    store.dispatch(changeHidePlatformDetails(true));
    const stackTimingByDepth = selectedThreadSelectors.getStackTimingByDepthForStackChart(
      store.getState()
    );

    expect(stackTimingByDepth).toEqual([
      { start: [0], end: [91], stack: [0], length: 1 },
      { start: [60], end: [91], stack: [1], length: 1 },
      { start: [70], end: [90], stack: [2], length: 1 },
      { start: [80], end: [90], stack: [3], length: 1 },
      { start: [80], end: [90], stack: [4], length: 1 },
    ]);
  });

  it('uses search strings', function() {
    const store = storeWithProfile();
    store.dispatch(changeCallTreeSearchString('javascript'));
    const stackTimingByDepth = selectedThreadSelectors.getStackTimingByDepthForStackChart(
      store.getState()
    );
    expect(stackTimingByDepth).toEqual([
      { start: [60], end: [91], stack: [0], length: 1 },
      { start: [60], end: [91], stack: [1], length: 1 },
      { start: [60], end: [91], stack: [4], length: 1 },
      { start: [70], end: [90], stack: [5], length: 1 },
      { start: [80], end: [90], stack: [6], length: 1 },
      { start: [80], end: [90], stack: [7], length: 1 },
      { start: [80], end: [90], stack: [8], length: 1 },
    ]);
  });

  /**
   * The inverted stack indices will not match this chart, as new indices will be
   * generated by the function that inverts the profile information.
   *
   *            Uninverted             ->             Inverted
   *   0-10-20-30-40-50-60-70-80-90-91      0-10-20-30-40-50-60-70-80-90-91 <- Timing (ms)
   *  ================================     ================================
   *  0P 0P 0P 0P 0P 0P 0P 0P 0P 0P  |     1P 2P 2P 3P 0P 1P 4J 5P 8J 4J
   *  1P 1P 1P 1P    1P 1P 1P 1P 1P  |     0P 1P 1P 1P    0P 1P 4P 7P 1P
   *     2P 2P 3P       4J 4J 4J 4J  |        0P 0P 0P       0P 1J 6P 0P
   *                       5J 5J     |                          0P 5J
   *                          6P     |                             4J
   *                          7P     |                             1P
   *                          8J     |                             0P
   */

  it('can handle inverted stacks', function() {
    const store = storeWithProfile();
    store.dispatch(changeInvertCallstack(true));
    const stackTimingByDepth = selectedThreadSelectors.getStackTimingByDepthForStackChart(
      store.getState()
    );
    expect(stackTimingByDepth).toEqual([
      {
        start: [0, 10, 30, 40, 50, 60, 70, 80, 90],
        end: [10, 30, 40, 50, 60, 70, 80, 90, 91],
        stack: [0, 2, 5, 8, 0, 9, 12, 16, 9],
        length: 9,
      },
      {
        start: [0, 10, 30, 50, 60, 70, 80, 90],
        end: [10, 30, 40, 60, 70, 80, 90, 91],
        stack: [1, 3, 6, 1, 10, 13, 17, 10],
        length: 8,
      },
      {
        start: [10, 30, 60, 70, 80, 90],
        end: [30, 40, 70, 80, 90, 91],
        stack: [4, 7, 11, 14, 18, 11],
        length: 6,
      },
      {
        start: [70, 80],
        end: [80, 90],
        stack: [15, 19],
        length: 2,
      },
      { start: [80], end: [90], stack: [20], length: 1 },
      { start: [80], end: [90], stack: [21], length: 1 },
      { start: [80], end: [90], stack: [22], length: 1 },
    ]);
  });
});

describe('selectors/getFlameGraphTiming', function() {
  /**
   * Map the flameGraphTiming data structure into a human readable format where
   * each line takes the form:
   *
   * "FunctionName1 (StartTime:EndTime) | FunctionName2 (StartTime:EndTime)"
   */
  function getHumanReadableFlameGraphTiming(store, funcNames) {
    const { callNodeTable } = selectedThreadSelectors.getCallNodeInfo(
      store.getState()
    );
    const flameGraphTiming = selectedThreadSelectors.getFlameGraphTiming(
      store.getState()
    );

    return flameGraphTiming.map(({ callNode, end, length, start }) => {
      const lines = [];
      for (let i = 0; i < length; i++) {
        const callNodeIndex = callNode[i];
        const funcIndex = callNodeTable.func[callNodeIndex];
        const funcName = funcNames[funcIndex];
        lines.push(`${funcName} (${start[i]}:${end[i]})`);
      }
      return lines.join(' | ');
    });
  }

  it('computes a basic example', function() {
    const { profile, funcNames } = getProfileFromTextSamples(`
      A A A
      B B B
      C C H
      D F I
      E G
    `);

    const store = storeWithProfile(profile);
    expect(getHumanReadableFlameGraphTiming(store, funcNames)).toEqual([
      'A (0:3)',
      'B (0:3)',
      'C (0:2) | H (2:3)',
      'D (0:1) | F (1:2) | I (2:3)',
      'E (0:1) | G (1:2)',
    ]);
  });

  it('can handle null samples', function() {
    const { profile, funcNames } = getProfileFromTextSamples(`
      A A X A
      B B   B
      C C   H
      D F   I
      E G
    `);

    // Remove the X sample by setting it's stack to null.
    profile.threads[0].samples.stack[2] = null;

    const store = storeWithProfile(profile);
    expect(getHumanReadableFlameGraphTiming(store, funcNames)).toEqual([
      'A (0:3)',
      'B (0:3)',
      'C (0:2) | H (2:3)',
      'D (0:1) | F (1:2) | I (2:3)',
      'E (0:1) | G (1:2)',
    ]);
  });

  it('weights heavier samples to the left', function() {
    const { profile, funcNames } = getProfileFromTextSamples(`
      A D D D
      B E F F
      C     G
    `);

    const store = storeWithProfile(profile);
    expect(getHumanReadableFlameGraphTiming(store, funcNames)).toEqual([
      'A (0:1) | D (1:4)',
      'B (0:1) | E (1:2) | F (2:4)',
      'C (0:1) | G (2:3)',
    ]);
  });
});

describe('selectors/getCallNodeMaxDepthForStackChart', function() {
  it('calculates the max func depth and observes of platform-detail filters', function() {
    const store = storeWithProfile();
    const allSamplesMaxDepth = selectedThreadSelectors.getCallNodeMaxDepthForStackChart(
      store.getState()
    );
    expect(allSamplesMaxDepth).toEqual(6);
    store.dispatch(changeHidePlatformDetails(true));
    const jsOnlySamplesMaxDepth = selectedThreadSelectors.getCallNodeMaxDepthForStackChart(
      store.getState()
    );
    expect(jsOnlySamplesMaxDepth).toEqual(4);
  });

  it('acts upon the current range', function() {
    const store = storeWithProfile();
    store.dispatch(addRangeFilter(0, 20));
    const allSamplesMaxDepth = selectedThreadSelectors.getCallNodeMaxDepthForStackChart(
      store.getState()
    );
    expect(allSamplesMaxDepth).toEqual(2);
    store.dispatch(changeHidePlatformDetails(true));
    const jsOnlySamplesMaxDepth = selectedThreadSelectors.getCallNodeMaxDepthForStackChart(
      store.getState()
    );
    expect(jsOnlySamplesMaxDepth).toEqual(0);
  });
});

describe('selectors/getLeafCategoryStackTimingForStackChart', function() {
  /**
   * This table shows off how stack timings get filtered to a single row by concurrent
   * color categories. P is platform code, J javascript baseline, and I is javascript
   * interpreter.
   *
   *            Unfiltered             ->      By Concurrent Leaf Category
   *   0-10-20-30-40-50-60-70-80-90-91      0-10-20-30-40-50-60-70-80-90-91 <- Timing (ms)
   *  ================================     ================================
   *  0P 0P 0P 0P 0P 0P 0P 0P 0P 0P  |     1P 1P 1P 1P 1P 1P 4J 4J 8I 4J  |
   *  1P 1P 1P 1P    1P 1P 1P 1P 1P  |
   *     2P 2P 3P       4J 4J 4J 4J  |
   *                       5J 5J     |
   *                          6P     |
   *                          7P     |
   *                          8I     |
   */
  it('gets the unfiltered leaf-stack timing by implementation', function() {
    const store = storeWithProfile();
    store.dispatch(changeStackChartColorStrategy(getCategoryByImplementation));
    const leafStackTiming = selectedThreadSelectors.getLeafCategoryStackTimingForStackChart(
      store.getState()
    );

    expect(leafStackTiming).toEqual([
      {
        start: [0, 60, 80, 90],
        end: [60, 80, 90, 91],
        stack: [1, 4, 8, 4],
        length: 4,
      },
    ]);
  });
});

describe('actions/changeImplementationFilter', function() {
  const store = storeWithProfile();

  it('is initially set to filter to all', function() {
    const filter = UrlStateSelectors.getImplementationFilter(store.getState());
    expect(filter).toEqual('combined');
  });

  it('can be changed to cpp', function() {
    store.dispatch(changeImplementationFilter('cpp'));
    const filter = UrlStateSelectors.getImplementationFilter(store.getState());
    expect(filter).toEqual('cpp');
  });
});

describe('actions/updateProfileSelection', function() {
  it('can update the selection with new values', function() {
    const store = storeWithProfile();

    const initialSelection = ProfileViewSelectors.getProfileViewOptions(
      store.getState()
    ).selection;
    expect(initialSelection).toEqual({
      hasSelection: false,
      isModifying: false,
    });

    store.dispatch(
      updateProfileSelection({
        hasSelection: true,
        isModifying: false,
        selectionStart: 100,
        selectionEnd: 200,
      })
    );

    const secondSelection = ProfileViewSelectors.getProfileViewOptions(
      store.getState()
    ).selection;
    expect(secondSelection).toEqual({
      hasSelection: true,
      isModifying: false,
      selectionStart: 100,
      selectionEnd: 200,
    });
  });
});
