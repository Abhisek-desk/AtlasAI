import api from "../../utils/axios.js";

const logout = async () => {
  try {
    const { data } = await api.post(
      "/api/auth/logout",
      {},
      { withCredentials: true }
    );

    console.log(data);
  } catch (error) {
    console.error("Logout error:", error.response?.data || error.message);
  }
};

export default logout;