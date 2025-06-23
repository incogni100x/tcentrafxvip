import { supabase } from './client.js';
import { cryptoTokens } from './crypto-tokens.js';

function renderCryptoCardSkeletons() {
    const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    if (!container) return;
    container.innerHTML = ''; // Clear just in case

    const skeletonCard = `
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 fund-card">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 w-full">
                <div class="skeleton w-10 h-10 rounded-full shrink-0"></div>
                <div class="space-y-2 w-full">
                    <div class="skeleton h-4 w-3/4"></div>
                    <div class="skeleton h-3 w-1/4"></div>
                </div>
            </div>
            <div class="space-y-2 w-20 shrink-0 ml-2">
                <div class="skeleton h-5 w-full"></div>
            </div>
        </div>
        <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
                <div class="skeleton h-3 w-28"></div>
                <div class="skeleton h-4 w-12"></div>
            </div>
            <div class="skeleton h-2 w-full rounded-full"></div>
        </div>
        <div class="flex gap-2">
            <div class="skeleton h-9 w-full rounded-md"></div>
            <div class="skeleton h-9 w-full rounded-md"></div>
        </div>
    </div>
    `;

    // Render 6 skeleton cards
    for (let i = 0; i < 6; i++) {
        container.insertAdjacentHTML('beforeend', skeletonCard);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const availableCryptosContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');

    async function fetchCryptoData() {
        try {
            const { data, error } = await supabase
                .from('crypto_tokens')
                .select('crypto_symbol, static_price, interest_rate');

            if (error) {
                console.error('Error fetching crypto data:', error);
                return;
            }

            renderCryptoCards(data);
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    async function renderCryptoCards(cryptoData) {
        if (!availableCryptosContainer) return;
        availableCryptosContainer.innerHTML = ''; // Clear existing cards

        const cardPromises = cryptoTokens.map(token => {
            const backendData = cryptoData.find(d => d.crypto_symbol === token.symbol);
            if (!backendData) return null; // Skip if no backend data
            return createCryptoCard(token, backendData);
        }).filter(Boolean);

        const cards = await Promise.all(cardPromises);
        cards.forEach(card => {
            if (card) availableCryptosContainer.appendChild(card);
        });
    }

    async function createCryptoCard(token, backendData) {
        const { symbol, name } = token;
        const { static_price, interest_rate } = backendData;
        
        const iconUrl = `assets/icons/crypto/${symbol.toUpperCase()}.svg`;
        let iconSvg;
        try {
            const response = await fetch(iconUrl);
            if (!response.ok) throw new Error(`Icon not found for ${symbol}`);
            const svgText = await response.text();
            
            // Create a temporary div to parse the SVG string
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgText.trim();
            const svgElement = tempDiv.firstChild;

            // Ensure it's an SVG and add necessary classes
            if (svgElement && svgElement.tagName && svgElement.tagName.toLowerCase() === 'svg') {
                svgElement.setAttribute('class', 'w-6 h-6');
                iconSvg = svgElement.outerHTML;
            } else {
                throw new Error('Fetched content was not a valid SVG');
            }
        } catch (e) {
            console.warn(e.message);
            // Fallback icon
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-gray-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }
        
        const card = document.createElement('div');
        card.className = 'bg-gray-800 border border-gray-700 rounded-lg p-4 fund-card';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        ${iconSvg}
                    </div>
                    <div>
                        <h3 class="font-semibold text-white text-base">${name}</h3>
                        <div class="text-xs text-gray-400">${symbol}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-semibold text-white">$${Number(static_price).toFixed(2)}</div>
                </div>
            </div>
            
            <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs text-gray-400">Guaranteed Interest Rate</span>
                    <span class="text-sm font-semibold text-green-400">${interest_rate}%</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" style="width: ${interest_rate}%"></div>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button class="flex-1 bg-blue-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                    Buy
                </button>
                <button class="flex-1 border border-gray-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium">
                    Sell
                </button>
            </div>
        `;
        return card;
    }

    renderCryptoCardSkeletons();
    fetchCryptoData();
}); 