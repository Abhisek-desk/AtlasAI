import { signInWithPopup } from "firebase/auth";
import api from "../../utils/axios.js";
import { auth, googleProvider } from "../../utils/firebase.js";
import { FcGoogle } from "react-icons/fc";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../redux/userSlice.js";
import Sidebar from "../components/Sidebar.jsx";
import ChatArea from "../components/ChatArea.jsx";
import Artifact from "../components/Artifact.jsx";

const Home = () => {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();

  const handleLogin = async (token) => {
    try {
      const { data } = await api.post(
        "/api/auth/login",
        { token },
        { withCredentials: true },
      );

      dispatch(setUserData(data.user));

      return true;
    } catch (error) {
      console.error(
        "Backend login failed:",
        error.response?.data || error.message,
      );

      return false;
    }
  };

  const googleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken(true);
      const loggedIn = await handleLogin(token);

      if (!loggedIn) {
        console.error("Backend authentication was unsuccessful.");
      }
    } catch (error) {
      console.error("Google sign-in failed:", error.message);
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#0d0f14] text-white">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <ChatArea />
        <Artifact />
      </div>

      {!userData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="flex w-full max-w-[340px] flex-col gap-5 rounded-2xl border border-white/[0.08] bg-[#13151c] p-7">
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-100">
                Welcome to AtlasAI
              </h2>

              <p className="text-sm text-slate-500">
                Please login to continue using the app.
              </p>
            </div>

            <button
              className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500 to-violet-700 py-[11px] text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-150 hover:from-indigo-400 hover:to-violet-600 hover:shadow-indigo-500/30 active:from-indigo-600 active:to-violet-800"
              onClick={googleLogin}
            >
              <FcGoogle size={15} />
              Continue with Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;