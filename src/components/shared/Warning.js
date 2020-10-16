/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @flow

import React, { PureComponent } from 'react';
import './Warning.css';
import explicitConnect from '../../utils/connect';
import { getProfile } from '../../selectors/profile';
import type { Profile } from 'firefox-profiler/types';
import type { ConnectedProps } from '../../utils/connect';

type OwnProps = {|
  +message: string,
  +actionText?: string,
  +actionTitle?: string,
  +actionOnClick?: () => mixed,
  +onClose?: () => mixed,
|};

type StateProps = {|
  +profile: Profile,
|};

type Props = ConnectedProps<OwnProps, StateProps>;
type State = {|
  +isNoticeDisplayed: boolean,
|};

class Warning extends PureComponent<Props, State> {
  state = { isNoticeDisplayed: true };

  _onHideClick = () => {
    this.setState({
      isNoticeDisplayed: false,
    });

    if (this.props.onClose) {
      this.props.onClose();
    }
  };

  render() {
    if (!this.state.isNoticeDisplayed) {
      return null;
    }

    const {
      message,
      actionText,
      actionTitle,
      actionOnClick,
      profile,
    } = this.props;

    const { meta } = profile;

    return (
      <>
        {meta.debug ? (
          <div className="warningMessageBarWrapper">
            <div className="photon-message-bar photon-message-bar-warning warningMessageBar">
              {message}
              {actionText ? (
                <button
                  className="photon-button photon-button-micro photon-message-bar-action-button"
                  type="button"
                  title={actionTitle}
                  aria-label={actionTitle}
                  onClick={actionOnClick}
                >
                  {actionText}
                </button>
              ) : null}
              <button
                className="photon-button photon-message-bar-close-button"
                type="button"
                aria-label="Hide the message"
                title="Hide the message"
                onClick={this._onHideClick}
              />
            </div>
          </div>
        ) : null}
      </>
    );
  }
}

export default explicitConnect<StateProps>({
  mapStateToProps: state => ({
    profile: getProfile(state),
  }),
  component: Warning,
});
