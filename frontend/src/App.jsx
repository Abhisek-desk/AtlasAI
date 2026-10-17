import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import api from "../utils/axios.js";

const App = () => {
  const handleLogin = async (token) => {
    try {
      const { data } = await api.post("/auth/login", { token });
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  };

  const googleLogin = async () => {
    try {
      const data = await signInWithPopup(auth, googleProvider);
      const token = await data.user.getIdToken();
      console.log(token);
      await handleLogin(token);
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <button className="w-50 h-24 bg-white" onClick={googleLogin}>
        Continue with Google
      </button>
    </div>
  );
};

export default App;
