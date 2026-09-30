import React from 'react';
import { staffAppT } from '../../../utils/staffAppI18n';

/**
 * Catches render errors in Staff App panels so one broken tab does not white-screen the portal.
 */
export default class StaffAppPanelErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[StaffAppPanelErrorBoundary]', error, info?.componentStack);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        const locale = this.props.locale || 'en';
        const t = this.props.t || ((key, vars) => staffAppT(locale, key, vars));

        if (this.state.error) {
            return (
                <div
                    className="staff-app-table-wrap"
                    style={{ padding: 20, borderColor: '#fecaca', background: '#fef2f2' }}
                >
                    <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>
                        {t('error.screenTitle')}
                    </h3>
                    <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#7f1d1d' }}>
                        {this.state.error?.message || t('error.unexpected')}
                    </p>
                    <button
                        type="button"
                        className="staff-app-btn staff-app-btn--primary"
                        onClick={() => this.setState({ error: null })}
                    >
                        {t('common.tryAgain')}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
