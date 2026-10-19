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
  },
});

export const {
  setConversations,
  addConversation,
  selectConversation,
  clearSelectedConversation,
} = conversationSlice.actions;

export default conversationSlice.reducer;
