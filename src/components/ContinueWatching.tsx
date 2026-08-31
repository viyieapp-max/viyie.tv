import { useMemo } from 'react';
import { Play, History } from 'lucide-react';
import { useUserData } from '../hooks/useUserData';
import type { Content } from '../types';
import { ScrollCarousel } from './ScrollCarousel';
import { OptimizedImage  } from "./UIComponents";
import { SectionHeader  } from "./UIComponents";



export function ContinueWatching({ 
  contents, 
  onSelectMovie, 
  onViewAll,
  innerStyle = {},
  carouselStyle = {},
}: { 
  contents: Content[], 
  onSelectMovie: (m: Content, epIndex?: number, snIndex?: number) => void, 
  onViewAll?: () => void,
  innerStyle?: React.CSSProperties,
  carouselStyle?: React.CSSProperties
}) {
  const { history } = useUserData();

  const continueItems = useMemo(() => {
    if (!history) return [];
    
    const items = [];
    const seenMovieIds = new Set();
    
    // history is already sorted by latest watched first
    for (const h of history) {
      if (seenMovieIds.has(String(h.movieId))) continue; // Only show the most recent episode watched for a series
      
      const movie = contents.find(c => String(c.id) === String(h.movieId));
      if (movie) {
        seenMovieIds.add(String(h.movieId));
        items.push({ history: h, movie });
      }
    }
    
    return items;
  }, [history, contents]);

  const displayedItems = continueItems.slice(0, 10);

  if (continueItems.length === 0) return null;

  return (
    <section className="relative z-10 bg-black py-5 border-t border-white/5">
      <div className="max-w-[2000px] mx-auto overflow-visible relative px-7 sm:px-[47px] lg:px-[56px]">
        <div>
          <SectionHeader
            innerStyle={innerStyle}
            title="Continue Watching"
            icon={History}
            description="Pick up where you left off"
            count={history.length}
            accent="from-red-600 to-orange-500"
            onViewAll={onViewAll}
          />
        </div>
        
        <ScrollCarousel 
          wrapperStyle={carouselStyle}
          className="mt-3 grid auto-cols-[180px] sm:auto-cols-[240px] md:auto-cols-[280px] lg:auto-cols-[240px] grid-flow-col gap-3 sm:gap-4 md:gap-5 pb-6 snap-x snap-mandatory pt-2">
          {displayedItems.map((item, idx) => {
            const isTv = item.movie.kind === "tv";
            const epIndex = item.history.episodeIndex || 0;
            const snIndex = item.history.seasonIndex || 0;
            
            // Get Thumbnail
            let thumb = item.movie.backdrop || item.movie.poster;
            let title = item.movie.title;
            let subtitle = "";
            if (isTv && item.movie.episodes && item.movie.episodes[epIndex]) {
               const ep = item.movie.episodes[epIndex];
               // Priority: Custom Episode Thumb -> Movie Backdrop -> YT Thumb -> Poster
               thumb = ep.thumbnail || item.movie.backdrop || item.movie.poster;
               subtitle = `S${snIndex + 1}:E${ep.number} - ${ep.title}`;
            } else if (!isTv && item.movie.embedUrl) {
               // Priority: Movie Backdrop -> YT Thumb -> Poster
               thumb = item.movie.backdrop || item.movie.poster;
               subtitle = "Movie";
            }

            // Always apply backdrop objectPosition if it's the backdrop or an episode thumbnail that doesn't have its own
            const applyPosition = thumb === item.movie.backdrop || thumb === item.movie.poster || (isTv && thumb === item.movie.episodes?.[epIndex]?.thumbnail);
            
            return (
              <div 
                key={idx} 
                onClick={() => onSelectMovie(item.movie, isTv ? epIndex : undefined, isTv ? snIndex : undefined)}
                className="w-full snap-start group cursor-pointer card-hover-trigger"
              >
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-white/5 shadow-lg transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                    <OptimizedImage 
                    src={thumb} 
                    fallbackSrc={item.movie.backdrop || item.movie.poster}
                    alt={title} 
                    className="w-full h-full object-cover transition-transform duration-500"
                    style={applyPosition ? { 
                      objectPosition: item.movie.backdropPosition || '50% 50%',
                      transform: `scale(${item.movie.backdropScale || 1}) rotate(${item.movie.backdropRotate || 0}deg)`,
                      transformOrigin: item.movie.backdropPosition || "50% 50%"
                    } : {}}
                    quality="medium"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent transition-opacity" />
                  
                  {/* Play Button Overlay (Hover) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)]">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                </div>

                {/* Progress Bar (Placed between thumbnail and title) */}
                <div className="mt-2.5 w-full bg-white/10 rounded-full h-1 sm:h-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-red-600 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, Math.max(0, (item.history.progress > 1 ? item.history.progress : (item.history.progress || 0) * 100)))}%` }}
                  />
                </div>

                {/* Subtitle Below */}
                <div className="mt-2 flex flex-col gap-1 min-h-[44px] sm:min-h-[50px] text-left">
                  <h3 className="notranslate text-[10px] sm:text-xs md:text-sm font-medium text-white truncate group-hover:text-red-400 transition-colors text-left" translate="no">
                    {title}
                  </h3>
                  <div className="flex items-center justify-start gap-2 text-[8px] sm:text-[10px] text-white/40 font-medium leading-none text-left">
                    <span className="notranslate truncate whitespace-nowrap" translate="no">{subtitle}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </ScrollCarousel>
      </div>
    </section>
  );
}
