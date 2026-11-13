import api from "../../utils/axios.js";

const logError = (label, error) =>
  console.error(label, error.response?.data || error.message);

/* ----------------------------- Projects ----------------------------------- */

export const fetchProjects = async () => {
  try {
    const { data } = await api.get("/api/chat/get-projects");
    return Array.isArray(data.projects) ? data.projects : [];
  } catch (error) {
    logError("Get projects error:", error);
    return [];
  }
};

export const createProject = async (name) => {
  try {
    const { data } = await api.post("/api/chat/create-project", { name });
    return data.project || null;
  } catch (error) {
    logError("Create project error:", error);
    return null;
  }
};

export const renameProject = async (projectId, name) => {
  try {
    const { data } = await api.put("/api/chat/update-project", {
      projectId,
      name,
    });
    return data.project || null;
  } catch (error) {
    logError("Rename project error:", error);
    return null;
  }
};

export const deleteProject = async (projectId) => {
  try {
    await api.delete(`/api/chat/delete-project/${projectId}`);
    return true;
  } catch (error) {
    logError("Delete project error:", error);
    return false;
  }
};

/* --------------------------- Conversations -------------------------------- */

// fields: any of { title, pinned, projectId } (projectId: null removes the
// chat from its project). Returns the updated conversation, or null.
export const updateConversationOnServer = async (conversationId, fields) => {
  try {
    const { data } = await api.put("/api/chat/update-conversation", {
      conversationId,
      ...fields,
    });
    return data.conversation || null;
  } catch (error) {
    logError("Update conversation error:", error);
    return null;
  }
};

export const deleteConversationOnServer = async (conversationId) => {
  try {
    await api.delete(`/api/chat/delete-conversation/${conversationId}`);
    return true;
  } catch (error) {
    logError("Delete conversation error:", error);
    return false;
  }
};