import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CookiesProvider } from 'react-cookie'
import { BrowserRouter, Routes, Route } from "react-router";
import MapView from './Map.tsx';
import DumpView from './Dump.tsx';

const mainDiv = document.getElementById('minusOne');
const mapDiv = document.getElementById('minusOneMap');

if (mainDiv) {
    createRoot(mainDiv).render(
        <CookiesProvider defaultSetOptions={{ path: '/' }} >
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<App />} />
                    <Route path="/map" element={<MapView />} />
                    <Route path="/dump" element={<DumpView />} />
                </Routes>
            </BrowserRouter>
        </CookiesProvider>
    )
} else if (mapDiv) {
    createRoot(mapDiv).render(
        <CookiesProvider defaultSetOptions={{ path: '/' }} >
            <MapView />
        </CookiesProvider>
    )
}
