import React from 'react';

export class TvErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[Noxis TV] Unhandled screen error', error, info);
    }

    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    handleReset = () => {
        this.setState({ error: null });
        this.props.onReset?.();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="tv-screen tv-fatal-error">
                <i className="fas fa-triangle-exclamation" />
                <h1>Bu ekran açılamadı</h1>
                <p>Uygulama verileri korunuyor. Ana ekrana dönüp yeniden deneyebilirsiniz.</p>
                <button
                    type="button"
                    className="focusable tv-action tv-action-primary"
                    data-tv-autofocus="true"
                    data-focus-id="tv-error-home"
                    data-tv-focus-group="tv-error-actions"
                    data-tv-focus-axis="horizontal"
                    data-tv-focus-index="0"
                    onClick={this.handleReset}
                >
                    <i className="fas fa-home" />
                    <span>Ana Sayfa</span>
                </button>
            </div>
        );
    }
}
