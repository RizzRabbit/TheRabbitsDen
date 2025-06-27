import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

console.log('main.ts is running!'); // Added for debugging

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
