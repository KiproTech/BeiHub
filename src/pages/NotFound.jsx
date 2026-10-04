import { Link } from '../lib/router.jsx'
import { Empty } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="wrap section">
      <Empty title="Page not found" action={<Link to="/" className="btn btn-primary btn-lg">Go to homepage</Link>}>
        The page you are looking for does not exist or has moved.
      </Empty>
    </div>
  )
}
