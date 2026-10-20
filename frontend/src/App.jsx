import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch } from "react-redux";
import Home from "./pages/Home";
import { getCurrentUser } from "./features/getCurrentUser";
import { setUserData } from "./redux/userSlice";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const getUser = async () => {
      const data = await getCurrentUser();
      dispatch(setUserData(data));
    };

    getUser();
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat/:conversationId" element={<Home />} />
    </Routes>
  );
};

export default App;