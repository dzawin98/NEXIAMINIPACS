import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageTitleUpdater = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'Nexia';

    if (path === '/' || path === '/login') {
      title = 'Login';
    } else if (path.startsWith('/worklist')) {
      title = 'Worklist';
    } else if (path.startsWith('/settings')) {
      title = 'Settings';
    }

    document.title = title;
  }, [location]);

  return null;
};

export default PageTitleUpdater;
