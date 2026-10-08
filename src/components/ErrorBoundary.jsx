import { Component } from 'react'

// If one page throws while rendering, show a friendly message instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.error('Page crashed:', err)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ maxWidth: 520, margin: '12vh auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>This page could not be shown. Please try again.</p>
        <p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>{' '}
          <a className="btn btn-outline" href="/">Go to the home page</a>
        </p>
      </main>
    )
  }
}
