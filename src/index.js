import React from 'react';
import { createRoot } from 'react-dom/client';

import Map from './Components/Map';
import Header from './Components/Header';

import './app.scss';


function App() {
	return(
		<div>
			<Map />
		</div>
	)
}

const container = document.getElementById('root');
const root = createRoot(container); 
root.render(<App />);