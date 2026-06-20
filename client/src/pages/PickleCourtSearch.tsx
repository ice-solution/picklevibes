import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PICKCOURT_HOME } from '../utils/pickcourtRoutes';

/** /search 導向首頁搜尋區塊，並保留查詢參數 */
const PickleCourtSearch = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    navigate(qs ? `${PICKCOURT_HOME}?${qs}#search` : `${PICKCOURT_HOME}#search`, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default PickleCourtSearch;
