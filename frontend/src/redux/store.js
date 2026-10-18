import {configureStore} from '@reduxjs/toolkit';
import useReducer from './userSlice.js';

export const store=configureStore({
  reducer:{
    user:useReducer
  },
})