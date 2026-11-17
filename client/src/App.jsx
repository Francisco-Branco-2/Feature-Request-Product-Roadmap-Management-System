import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeForRole } from './hooks/useAuth';
import { CustomerLayout, DevLayout, PmLayout, PoLayout } from './components/Layouts';
import Login from './pages/Login';
import MyRequests from './pages/customer/MyRequests';
import NewRequest from './pages/customer/NewRequest';
import SearchRequests from './pages/customer/SearchRequests';
import RequestDetail from './pages/customer/RequestDetail';
import PoRequests from './pages/po/PoRequests';
import PoRequestDetail from './pages/po/PoRequestDetail';
import MergeRequests from './pages/po/MergeRequests';
import Backlog from './pages/shared/Backlog';
import Roadmap from './pages/shared/Roadmap';
import Metrics from './pages/shared/Metrics';
import Notifications from './pages/shared/Notifications';
import TeamWorkspace from './pages/shared/TeamWorkspace';
import FeatureDetail from './pages/dev/FeatureDetail';
import FeaturesList from './pages/dev/FeaturesList';
import Releases from './pages/pm/Releases';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 40 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          loading ? (
            <p style={{ padding: 40 }}>Loading…</p>
          ) : user ? (
            <Navigate to={homeForRole(user.role)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/customer"
        element={
          <Guard roles={['customer']}>
            <CustomerLayout />
          </Guard>
        }
      >
        <Route path="requests" element={<MyRequests />} />
        <Route path="requests/:number" element={<RequestDetail />} />
        <Route path="new" element={<NewRequest />} />
        <Route path="search" element={<SearchRequests />} />
      </Route>

      <Route
        path="/po"
        element={
          <Guard roles={['product_owner']}>
            <PoLayout />
          </Guard>
        }
      >
        <Route path="requests" element={<PoRequests />} />
        <Route path="requests/:number" element={<PoRequestDetail />} />
        <Route path="backlog" element={<Backlog />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="merge" element={<MergeRequests />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route
        path="/dev"
        element={
          <Guard roles={['developer']}>
            <DevLayout />
          </Guard>
        }
      >
        <Route path="workspace" element={<TeamWorkspace />} />
        <Route path="features" element={<FeaturesList />} />
        <Route path="features/:code" element={<FeatureDetail />} />
        <Route path="backlog" element={<Backlog />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route
        path="/pm"
        element={
          <Guard roles={['project_manager']}>
            <PmLayout />
          </Guard>
        }
      >
        <Route path="releases" element={<Releases />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="workspace" element={<TeamWorkspace />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
