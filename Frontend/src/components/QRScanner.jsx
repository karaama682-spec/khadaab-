import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

// html5-qrcode renders its own English controls and has no language option, so
// in Somali mode its visible text is swapped in place (display only).
const SCANNER_SOMALI = [
    ['Or drop an image to scan (other files not supported)', 'Ama halkan soo dhig sawir si loo akhriyo (faylal kale lama taageero)'],
    ['Or drop an image to scan', 'Ama halkan soo dhig sawir si loo akhriyo'],
    ['Requesting camera permissions...', 'Waxaa la codsanayaa ogolaanshaha kamarada...'],
    ['Request Camera Permissions', 'Codso Ogolaanshaha Kamarada'],
    ['Scan using camera directly', 'Ku akhri kamarada si toos ah'],
    ['Scan an Image File', 'Akhri Fayl Sawir ah'],
    ['Launching Camera...', 'Kamarada waa la furayaa...'],
    ['Camera based scan', 'Akhris kamarad'],
    ['Fule based scan', 'Akhris fayl'],
    ['Anonymous Camera', 'Kamarad aan magac lahayn'],
    ['Loading image...', 'Sawirka waa la soo rarayaa...'],
    ['No camera found', 'Kamarad lama helin'],
    ['No image choosen', 'Sawir lama dooran'],
    ['Switch Off Torch', 'Dami Tooshka'],
    ['Switch On Torch', 'Shid Tooshka'],
    ['Start Scanning', 'Bilow Akhriska'],
    ['Stop Scanning', 'Jooji Akhriska'],
    ['Choose Another', 'Dooro Mid Kale'],
    ['Choose Image', 'Dooro Sawir'],
    ['Select Camera', 'Dooro Kamarada'],
    ['Scanner paused', 'Akhriska waa la hakiyey'],
    ['Report issues', 'Soo sheeg dhibaatooyin'],
    ['Code Scanner', 'Akhriyaha Koodka'],
    ['Last Match: ', 'Natiijadii u dambeysay: '],
    ['No Cameras', 'Kamarad ma jirto'],
    ['Powered by ', 'Waxaa sameeyey '],
    ['Permission', 'Ogolaansho'],
    ['Scanning', 'Akhrinaya'],
    ['Idle', 'Nasasho'],
    ['Error', 'Khalad'],
    ['zoom', 'weyneyn']
];
const localizeScannerText = (text) => {
    let out = text;
    for (const [en, so] of SCANNER_SOMALI) if (out.includes(en)) out = out.split(en).join(so);
    return out;
};

const QRScanner = ({ onScan, onClose, title }) => {
    const { t, language } = useLanguage();
    const scannerRef = useRef(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        });

        scanner.render((decodedText) => {
            onScan(decodedText);
            scanner.clear();
        }, (error) => {
            // console.warn(error);
        });

        return () => {
            scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        };
    }, [onScan]);

    useEffect(() => {
        const root = document.getElementById('reader');
        if (!root || language !== 'so') return undefined;
        const apply = () => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const next = localizeScannerText(node.nodeValue);
                if (next !== node.nodeValue) node.nodeValue = next;
            }
            root.querySelectorAll('input[type="button"], input[type="submit"]').forEach((el) => {
                const next = localizeScannerText(el.value);
                if (next !== el.value) el.value = next;
            });
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [language]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-500">
                            <Camera size={20} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title || t('attendance.qr.scanTitle')}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    <div id="reader" className="overflow-hidden rounded-3xl border-4 border-slate-100 dark:border-slate-800 shadow-inner"></div>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            {t('attendance.qr.hint')}
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 transition-all"
                    >
                        {t('attendance.qr.closeCamera')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
