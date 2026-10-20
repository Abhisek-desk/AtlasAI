import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",

  initialState: {
    conversations: [],
    selectedConversation: null,
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
  },
});

export const {
  setConversations,
  addConversation,
  selectConversation,
  clearSelectedConversation,
  updateConversation,
  setConversationTitle
} = conversationSlice.actions;

export default conversationSlice.reducer;
