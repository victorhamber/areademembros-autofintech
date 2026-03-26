import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFReader.css';

// Set up worker globally
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  url: string;
  title: string;
  onClose: () => void;
}

export const PDFReader: React.FC<PDFReaderProps> = ({ url, title, onClose }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(window.innerWidth - 32);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      // 32px to account for some padding margin on mobile
      setContainerWidth(entries[0].contentRect.width - 32);
    });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <div className="pdf-reader-container">
      <header className="pdf-header">
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={24} />
        </button>
        <h2 className="pdf-title">{title}</h2>
        <div style={{ width: 24 }}></div> {/* spacer */}
      </header>

      <div className="pdf-content" ref={containerRef}>
        <Document 
          file={url} 
          onLoadSuccess={onDocumentLoadSuccess} 
          loading={<div className="pdf-loading">Carregando livro...</div>}
        >
          <Page 
            pageNumber={pageNumber} 
            width={Math.min(containerWidth, 800)} 
            renderTextLayer={false} 
            renderAnnotationLayer={false} 
          />
        </Document>
      </div>

      <div className="pdf-controls">
        <button 
          disabled={pageNumber <= 1} 
          onClick={() => setPageNumber(p => p - 1)}
          className="control-btn"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="page-indicator">
          {pageNumber} / {numPages || '--'}
        </span>
        <button 
          disabled={pageNumber >= (numPages || 1)} 
          onClick={() => setPageNumber(p => p + 1)}
          className="control-btn"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
