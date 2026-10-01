import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** When this value changes (e.g. the user opens another page) the boundary resets itself. */
  resetKey?: string;
  /** Short label shown in the message, e.g. the page name. */
  label?: string;
};

type State = { error: Error | null };

/**
 * Catches a render crash inside one page so the rest of the app (sidebar, other pages)
 * keeps working, instead of the whole screen going blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "page", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" style={{ padding: "32px", maxWidth: 640 }}>
        <h2 style={{ margin: "0 0 8px" }}>This page hit a problem</h2>
        <p style={{ margin: "0 0 12px" }}>
          {this.props.label ? `"${this.props.label}" could not be displayed. ` : ""}
          The rest of the app is still working — use the menu to open another page.
        </p>
        <p style={{ margin: "0 0 16px", opacity: 0.7, fontSize: 13 }}>Details: {this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
