import React, { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';

const GlobeView = ({ data, selectedMovieId, onMovieSelect }) => {
    const globeContainerRef = useRef(null);
    const globeInstance = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Initialize globe
    useEffect(() => {
        if (!globeContainerRef.current) return;

        // Initialize dimensions
        const { clientWidth, clientHeight } = globeContainerRef.current;

        // Create globe instance
        const globe = Globe()(globeContainerRef.current)
            .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
            .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
            .showAtmosphere(true)
            .atmosphereColor('#3a86ff')
            .atmosphereAltitude(0.25)
            .width(clientWidth)
            .height(clientHeight);

        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.5;
        globe.controls().enableDamping = true;

        // Configure point layer
        globe
            .pointsData([])
            .pointLat('lat')
            .pointLng('lng')
            .pointColor(() => '#00ffcc')
            .pointAltitude(0.01)
            .pointRadius(0.5)
            .pointsMerge(false)
            .pointResolution(32)
            // Use htmlElements for points to make them glow and interactive
            .htmlElementsData([])
            .htmlLat(d => d.lat)
            .htmlLng(d => d.lng)
            .htmlElement(d => {
                const el = document.createElement('div');
                el.className = 'globe-marker-poster';
                el.dataset.id = d.id;

                const img = document.createElement('img');
                img.src = d.cover_url || '';
                img.alt = d.title;
                img.className = 'marker-img';
                img.onerror = () => { img.style.display = 'none'; };

                el.appendChild(img);

                // Add subtle animation delay for organic feel
                el.style.animationDelay = `${Math.random() * 2}s`;

                // IMPORTANT: Enable pointer events and add click listener
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'pointer';
                el.onclick = (e) => {
                    // Stop event from bubbling to the globe container
                    e.stopPropagation();
                    console.log("Clicked movie on globe:", d.title);
                    onMovieSelect(d);
                };
                return el;
            });

        globeInstance.current = globe;

        // Handle resize
        const handleResize = () => {
            if (globeContainerRef.current && globeInstance.current) {
                const { clientWidth, clientHeight } = globeContainerRef.current;
                globeInstance.current.width(clientWidth);
                globeInstance.current.height(clientHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (globeInstance.current) {
                // Clean up globe instance if possible or just let GC handle it
            }
        };
    }, []);

    // Update data when it changes
    useEffect(() => {
        if (globeInstance.current && data) {
            // Use htmlElements for the rich markers
            globeInstance.current.htmlElementsData(data);
        }
    }, [data]);

    // Focus on selected movie
    useEffect(() => {
        if (globeInstance.current && data) {
            // Update selected class on all markers
            document.querySelectorAll('.globe-marker-poster').forEach(el => {
                el.classList.remove('selected');
            });
            if (selectedMovieId) {
                const selected = data.find(d => d.id === selectedMovieId);
                if (selected) {
                    // Stop auto rotation when focusing
                    globeInstance.current.controls().autoRotate = false;
                    // Point camera to the location
                    globeInstance.current.pointOfView({
                        lat: selected.lat,
                        lng: selected.lng,
                        altitude: 1.5
                    }, 1000);
                    // Mark the element after camera moves
                    setTimeout(() => {
                        document.querySelectorAll('.globe-marker-poster').forEach(el => {
                            if (el.dataset.id === String(selectedMovieId)) {
                                el.classList.add('selected');
                            }
                        });
                    }, 200);
                }
            } else {
                // Resume rotation if nothing selected
                globeInstance.current.controls().autoRotate = true;
            }
        }
    }, [selectedMovieId, data]);

    return <div ref={globeContainerRef} style={{ width: '100%', height: '100%' }} />;
};

export default GlobeView;
