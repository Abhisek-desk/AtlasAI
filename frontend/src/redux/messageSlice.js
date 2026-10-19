import { createSlice } from "@reduxjs/toolkit";

const messageSlice = createSlice({
  name: "message",

  initialState: {
    messages: [],
    loading: false,
    error: null,
  },

  reducers: {
    setMessages: (state, action) => {
      state.messages = Array.isArray(action.payload)
        ? action.payload
        : [];
    },

    addMessage: (state, action) => {
      if (action.payload) {
        state.messages.push(action.payload);
      }
    },

    updateMessage: (state, action) => {
      const { id, updatedMessage } = action.payload;

      const index = state.messages.findIndex(
        (message) => message._id === id || message.id === id
      );

      if (index !== -1) {
        state.messages[index] = {
          ...state.messages[index],
          ...updatedMessage,
        };
      }
    },

    clearMessages: (state) => {
      state.messages = [];
      state.error = null;
    },

    setMessageLoading: (state, action) => {
      state.loading = action.payload;
    },

    setMessageError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const {
  setMessages,
  addMessage,
  updateMessage,
  clearMessages,
  setMessageLoading,
  setMessageError,
} = messageSlice.actions;

export default messageSlice.reducer;