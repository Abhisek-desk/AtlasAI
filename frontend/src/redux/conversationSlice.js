import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",

  initialState: {
    conversations: [],
    selectedConversation: null,
    projects: [],
  },

  reducers: {
    setConversations: (state, action) => {
      state.conversations = Array.isArray(action.payload) ? action.payload : [];
    },

    addConversation: (state, action) => {
      if (action.payload) {
        state.conversations.unshift(action.payload);
        state.selectedConversation = action.payload;
      }
    },

    selectConversation: (state, action) => {
      state.selectedConversation = action.payload;
    },

    clearSelectedConversation: (state) => {
      state.selectedConversation = null;
    },

    updateConversation: (state, action) => {
      const { _id, title } = action.payload;

      const conversation = state.conversations.find((item) => item._id === _id);

      if (conversation) {
        conversation.title = title;
      }

      if (state.selectedConversation?._id === _id) {
        state.selectedConversation.title = title;
      }
    },
    setConversationTitle: (state, action) => {
      const { _id, title } = action.payload;

      const conversation = state.conversations.find((item) => item._id === _id);

      if (conversation) {
        conversation.title = title;
      }

      if (state.selectedConversation?._id === _id) {
        state.selectedConversation.title = title;
      }
    },

    // Change any fields of a conversation: { _id, title?, pinned?, projectId? }
    patchConversation: (state, action) => {
      const { _id, ...changes } = action.payload;

      const conversation = state.conversations.find((item) => item._id === _id);

      if (conversation) {
        Object.assign(conversation, changes);
      }

      if (state.selectedConversation?._id === _id) {
        Object.assign(state.selectedConversation, changes);
      }
    },

    removeConversation: (state, action) => {
      const id = action.payload;

      state.conversations = state.conversations.filter(
        (item) => item._id !== id,
      );

      if (state.selectedConversation?._id === id) {
        state.selectedConversation = null;
      }
    },

    /* ------------------------------ Projects ------------------------------ */

    setProjects: (state, action) => {
      state.projects = Array.isArray(action.payload) ? action.payload : [];
    },

    addProject: (state, action) => {
      if (action.payload) {
        state.projects.unshift(action.payload);
      }
    },

    updateProject: (state, action) => {
      const { _id, name } = action.payload;

      const project = state.projects.find((item) => item._id === _id);

      if (project) {
        project.name = name;
      }
    },

    // Deleting a project keeps its chats: they just leave the project.
    removeProject: (state, action) => {
      const id = action.payload;

      state.projects = state.projects.filter((item) => item._id !== id);

      for (const conversation of state.conversations) {
        if (String(conversation.projectId) === id) {
          conversation.projectId = null;
        }
      }

      if (String(state.selectedConversation?.projectId) === id) {
        state.selectedConversation.projectId = null;
      }
    },
  },
});

export const {
  setConversations,
  addConversation,
  selectConversation,
  clearSelectedConversation,
  updateConversation,
  setConversationTitle,
  patchConversation,
  removeConversation,
  setProjects,
  addProject,
  updateProject,
  removeProject,
} = conversationSlice.actions;

export default conversationSlice.reducer;