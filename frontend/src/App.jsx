import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch } from "react-redux";
import Home from "./pages/Home";
import LoadingAnimation from "./components/LoadingAnimation";
import { getCurrentUser } from "./features/getCurrentUser";
import { setUserData } from "./redux/userSlice";

const App = () => {
  const dispatch = useDispatch();
  // Without this the login popup flashes on every refresh until /api/me answers.
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const getUser = async () => {
      try {
        const data = await getCurrentUser();

        if (!cancelled) dispatch(setUserData(data));
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    };

    getUser();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (checkingAuth) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-[#0d0f14]">
        <LoadingAnimation variant="page" label="Loading AtlasAI..." />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat/:conversationId" element={<Home />} />
    </Routes>
  );
};

export default App;