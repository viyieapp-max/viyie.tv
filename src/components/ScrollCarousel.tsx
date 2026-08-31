import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ScrollCarousel({ 
  children, 
  className = "",
  style = {},
  wrapperStyle = {},
  hoverExpand = true,
}: { 
  children: React.ReactNode, 
  className?: string,
  style?: React.CSSProperties,
  wrapperStyle?: React.CSSProperties,
  hoverExpand?: boolean,
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [paddingRight, setPaddingRight] = useState(120);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsDesktop(w >= 1024);
      if (w >= 1536) {
        setPaddingRight(120 * 1.3); // Large Desktop: 120px * 1.3 = 156px
      } else if (w >= 1280) {
        setPaddingRight(120 * 1.18); // Desktop Baseline: 120px * 1.18 = 141.6px (climbs to ~144px)
      } else {
        setPaddingRight(120);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isCarouselHovered, setIsCarouselHovered] = useState(false);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    if (scrollWidth <= 0 || clientWidth <= 0) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
    
    // Use smaller threshold for more responsive UI
    const canScrollLeft = scrollLeft > 10;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 10;
    
    setShowLeft(canScrollLeft);
    setShowRight(canScrollRight);
  }, []);

  useEffect(() => {
    const ele = scrollRef.current;
    if (!ele) return;

    // Initial check with a bit of delay to let content render
    const timeout = setTimeout(checkScroll, 300);
    
    ele.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    
    resizeObserver.observe(ele);

    return () => {
      clearTimeout(timeout);
      ele.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll, children]); // Re-run if children change structure

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({ 
        left: dir === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  // Determine wrapper classes
  const outdentClasses = ""; 
  
  // Clean up inner classes - remove flex if grid is present
  let displayClass = "flex items-stretch";
  if (className.includes("grid")) {
    displayClass = ""; 
  }

  // Filter out any margin or padding overrides from style prop
  const {
    paddingTop: _pt,
    paddingBottom: _pb,
    marginTop: _mt,
    marginBottom: _mb,
    ...cleanStyle
  } = style || {};

  // Compute dynamic padding & margins
  const dynamicSpacing = (isDesktop && hoverExpand) ? {
    paddingTop: isCarouselHovered ? "260px" : "8px",
    paddingBottom: isCarouselHovered ? "260px" : "8px",
    marginTop: isCarouselHovered ? "-260px" : "-8px",
    marginBottom: isCarouselHovered ? "-260px" : "-8px",
  } : {
    paddingTop: "0px",
    paddingBottom: "0px",
    marginTop: "0px",
    marginBottom: "0px",
  };

  return (
    <div 
      className={`relative group/carousel ${outdentClasses} overflow-visible w-full`}
      style={wrapperStyle}
      onMouseEnter={() => setIsCarouselHovered(true)}
      onMouseLeave={() => setIsCarouselHovered(false)}
    >
      {/* Scrollable Area */}
      <div 
        ref={scrollRef}
        className={`${displayClass} ${className} hide-scrollbar overscroll-x-contain overflow-x-auto relative z-10 p-0 m-0 w-full`}
        style={{ 
          scrollbarWidth: "none", 
          msOverflowStyle: "none",
          ...dynamicSpacing,
          ...cleanStyle,
          ...(isDesktop ? {
            paddingRight: `${paddingRight}px`,
            marginLeft: "10px",
            width: cleanStyle.width || "100%",
          } : {}),
        }}
      >
        {children}
      </div>

      {/* Left Arrow */}
      <div 
        className={`absolute top-0 bottom-0 left-0 w-16 z-30 pointer-events-none transition-all duration-500 opacity-0 group-hover/carousel:opacity-100 ${!showLeft ? 'hidden' : ''}`}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); scroll('left'); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center pointer-events-auto transition-all duration-300 text-white hover:scale-125 active:scale-95 bg-transparent"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-8 h-8 sm:w-12 sm:h-12 drop-shadow-[0_0_15px_rgba(0,0,0,1)] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" />
        </button>
      </div>

      {/* Right Arrow */}
      <div 
        className={`absolute top-0 bottom-0 right-0 w-16 z-30 pointer-events-none transition-all duration-500 opacity-0 group-hover/carousel:opacity-100 ${!showRight ? 'hidden' : ''}`}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); scroll('right'); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center pointer-events-auto transition-all duration-300 text-white hover:scale-125 active:scale-95 bg-transparent"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-8 h-8 sm:w-12 sm:h-12 drop-shadow-[0_0_15px_rgba(0,0,0,1)] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" />
        </button>
      </div>
    </div>
  );
}
