import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Trash2, Reply, ChevronDown, BadgeCheck, Flag, AlertTriangle, X, ThumbsUp, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { db, collection, query, where, orderBy, onSnapshot, setDoc, doc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDocs } from "../lib/firebase";
import { useUserData } from "../hooks/useUserData";

// Tier Badge Component - Supports multiple badges
const TierBadges = ({ tiers = [], title }: { tiers?: string[], title?: string }) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tiers.map((tier) => {
        if (tier === "owner") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-yellow-600/20 to-orange-500/20 px-2 py-0.5 rounded border border-yellow-500/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1">
                <Crown className="w-3 h-3 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest drop-shadow-md">Owner</span>
              </div>
            </div>
          );
        }
        if (tier === "admin") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-red-600/20 to-orange-500/20 px-2 py-0.5 rounded border border-red-500/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-red-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-red-400 text-[9px] font-black uppercase tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">Admin</span>
              </div>
            </div>
          );
        }
        if (tier === "viyie_plus") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-[#ffe100]/20 to-[#ff8c00]/20 px-2 py-0.5 rounded border border-[#ffaa00]/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-[#ffaa00] group-hover:animate-pulse transition-transform duration-300" />
                <span className="text-[#ffaa00] text-[9px] font-black uppercase tracking-widest animate-gold-shine">Viyie+</span>
              </div>
            </div>
          );
        }
        return null;
      })}
      {title && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-lg text-[8px] font-black uppercase tracking-wider h-5">
          <BadgeCheck className="w-2.5 h-2.5 text-blue-400" />
          {title}
        </div>
      )}
    </div>
  );
};

export default function CommentSection({ 
  contentId, 
  user: initialUser,
  isAdmin,
  onUserClick
}: { 
  contentId: string; 
  user: any;
  isAdmin?: boolean;
  onUserClick?: (uid: string) => void;
}) {
  const { openAuth, user: contextUser, toast } = useUserData();
  const user = contextUser || initialUser;
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [limitCount, setLimitCount] = useState(6);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [reportComment, setReportComment] = useState<any>(null);
  const [reportReason, setReportReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Anti-spam states
  const lastCommentTimeRef = useRef<number>(0);
  const recentMessagesRef = useRef<string[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "comments"), 
      where("contentId", "==", contentId), 
      orderBy("timestamp", "desc") // Latest first
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setComments(list);
    }, (error) => {
      console.error("Error fetching comments:", error);
    });
    return unsub;
  }, [contentId]);

  const handlePost = async (parentId: string | null = null) => {
    const text = parentId ? replyTo?.replyText : newComment; // Fixed replyTo path from replyTo.text to replyTo.replyText
    if (!user || !text?.trim() || isPosting) return;

    if (user.commentBannedUntil) {
      const until = user.commentBannedUntil;
      if (until === "permanent" || new Date(until).getTime() > Date.now()) {
        const msg = until === "permanent" 
          ? "You have been permanently banned from commenting." 
          : `You have been banned from commenting until: ${new Date(until).toLocaleString('en-GB')}`;
        toast(msg, "error");
        return;
      }
    }

    const trimmedText = text.trim();

    // Link detection
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}\b)/i;
    if (linkRegex.test(trimmedText)) {
      toast("We do not allow users to send links", "error");
      if (parentId) {
        setReplyTo(null);
      } else {
        setNewComment("");
      }
      return;
    }

    // Cooldown detection
    const now = Date.now();
    if (now - lastCommentTimeRef.current < 2000) {
      toast("Please do not send discussions too fast", "error");
      return;
    }

    // Same message detection
    recentMessagesRef.current.push(trimmedText);
    if (recentMessagesRef.current.length > 5) {
      recentMessagesRef.current.shift();
    }
    const isSpam = recentMessagesRef.current.length === 5 && recentMessagesRef.current.every((msg) => msg === trimmedText);
    
    if (isSpam) {
      const banUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      toast("You sent 5 identical messages in a row, you are banned for 1 hour", "error");
      try {
        await updateDoc(doc(db, "users", user.uid), {
          commentBannedUntil: banUntil
        });
      } catch(err) {
        console.error("Error banning user:", err);
      }
      if (parentId) {
        setReplyTo(null);
      } else {
        setNewComment("");
      }
      return;
    }

    lastCommentTimeRef.current = now;
    
    setIsPosting(true);
    try {
      await setDoc(doc(collection(db, "comments")), {
        contentId,
        parentId: parentId,
        uid: user.uid,
        userName: user.name || "User",
        userUsername: user.username || "@user",
        userPhoto: user.picture || null,
        userTiers: user.tiers || [user.tier || "regular"],
        userBadgeTitle: user.badgeTitle || null,
        text: trimmedText,
        timestamp: serverTimestamp(),
      });

      // Maintain a maximum of 100 comments globally across the entire database/platform
      try {
        const qAll = query(collection(db, "comments"), orderBy("timestamp", "asc"));
        const allCommentsSnap = await getDocs(qAll);
        if (allCommentsSnap.size > 100) {
          const overage = allCommentsSnap.size - 100;
          const docsToDelete = allCommentsSnap.docs.slice(0, overage);
          for (const docSnap of docsToDelete) {
            await deleteDoc(doc(db, "comments", docSnap.id));
          }
        }
      } catch (cleanupError) {
        console.error("Error maintaining database comment cap of 100:", cleanupError);
      }

      setNewComment("");
      setReplyTo(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string, _timestamp: any, commentUid: string) => {
    const isOwn = user?.uid === commentUid;
    const canDelete = isAdmin || isOwn;

    if (!canDelete) return;

    const repliesToDelete = comments.filter(c => c.parentId === commentId).map(c => c.id);

    // Optimistic update
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
    
    try {
      await deleteDoc(doc(db, "comments", commentId));
      for (const repId of repliesToDelete) {
         await deleteDoc(doc(db, "comments", repId));
      }
    } catch (e: any) {
      console.error("Error deleting comment:", e);
      // Let the snapshot revert it if there's a real failure, though in offline mode it stays pending
    }
  };

  const handleLike = async (commentId: string, currentLikes: string[] = []) => {
    if (!user) return alert("Please login to like comments");
    
    const isLiked = currentLikes.includes(user.uid);
    const commentRef = doc(db, "comments", commentId);
    
    // Optimistic UI update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          likes: isLiked ? c.likes?.filter((id: string) => id !== user.uid) : [...(c.likes || []), user.uid]
        };
      }
      return c;
    }));

    try {
      await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (e) {
      console.error("Error liking comment:", e);
    }
  };

  const handleReport = async () => {
    if (!reportComment || !user || (!reportReason && !customReason)) return;
    setIsReporting(true);
    try {
      const reportRef = doc(collection(db, "reports"));
      await setDoc(reportRef, {
        id: reportRef.id,
        contentId,
        commentId: reportComment.id,
        commentText: reportComment.text,
        commentUser: reportComment.userName,
        commentUid: reportComment.uid,
        reporterUid: user.uid,
        reporterEmail: user.email || "",
        reason: reportReason === "Other" ? customReason : reportReason,
        status: "pending",
        timestamp: serverTimestamp()
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportComment(null);
        setReportSuccess(false);
        setReportReason("");
        setCustomReason("");
      }, 2000);
    } catch (e) {
      console.error("Error reporting comment:", e);
      alert("Failed to send report. Try again.");
    } finally {
      setIsReporting(false);
    }
  };

  const toggleReplies = (id: string) => {
    setExpandedReplies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const mainComments = comments.filter(c => !c.parentId).slice(0, limitCount);
  const getReplies = (id: string) => comments.filter(c => c.parentId === id);

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
        <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
          Discussions
          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-red-500/20">
            {comments.length}
          </span>
        </h3>
      </div>

      <div className="bg-[#000000] border border-white/10 rounded-[2rem] p-3 md:p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/5 rounded-full blur-[80px] pointer-events-none" />

        {user ? (
          <div className="flex gap-2 md:gap-4 relative z-10">
            <button 
              onClick={() => onUserClick?.(user.uid)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 shrink-0 overflow-hidden hover:scale-110 transition-transform"
            >
              <img 
                src={user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-full h-full object-cover" 
                alt="Avatar"
              />
            </button>
            <div className="flex-1 space-y-3">
              {user.commentBannedUntil && (
                (() => {
                  const until = user.commentBannedUntil;
                  const isBanned = until === "permanent" || new Date(until).getTime() > Date.now();
                  if (!isBanned) return null;
                  
                  return (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-red-500 uppercase tracking-widest">Access Restricted</p>
                        <p className="text-[10px] text-red-400/70 font-medium leading-relaxed">
                          {until === "permanent" 
                            ? "Your commenting privilege has been permanently revoked." 
                            : `Temporary suspension active until: ${new Date(until).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  );
                })()
              )}
              <div className="relative group">
                <textarea
                  value={newComment}
                  onChange={(e) => {
                    setNewComment(e.target.value);
                    if (e.target.value.length > 100) setNewComment(e.target.value.slice(0, 100));
                  }}
                  disabled={Boolean(user.commentBannedUntil && (user.commentBannedUntil === "permanent" || new Date(user.commentBannedUntil).getTime() > Date.now()))}
                  placeholder={user.commentBannedUntil && (user.commentBannedUntil === "permanent" || new Date(user.commentBannedUntil).getTime() > Date.now()) ? "You are currently banned." : "Share your thoughts about this title..."}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/50 transition-all resize-none disabled:opacity-20 min-h-[50px] max-h-[300px]"
                  rows={3}
                  maxLength={100}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  <span className={`text-[9px] font-medium ${newComment.length > 80 ? "text-red-500" : "text-white/10"}`}>
                    {newComment.length}/100
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handlePost()}
                  disabled={!newComment.trim() || isPosting || (user.commentBannedUntil && (user.commentBannedUntil === "permanent" || new Date(user.commentBannedUntil).getTime() > Date.now()))}
                  className="px-8 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-900/40 hover:scale-[1.05] active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all flex items-center gap-2 group/post"
                >
                  <Send className="w-3.5 h-3.5 transition-transform group-hover/post:translate-x-0.5 group-hover/post:-translate-y-0.5" />
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm text-white/40 mb-6 font-medium">Join our community to leave a comment</p>
            <button 
              onClick={openAuth}
              className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-black uppercase text-[11px] tracking-widest transition-all hover:scale-105 shadow-xl shadow-red-900/50"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}

        <div className="mt-12 space-y-12 relative z-10">
          <AnimatePresence>
            {mainComments.map((comment) => {
              const replies = getReplies(comment.id);
              const isExpanded = expandedReplies[comment.id];

              return (
                <div key={comment.id} className="group/item">
                  <CommentItem 
                    comment={comment}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDelete}
                    onReply={() => setReplyTo(comment)}
                    onUserClick={onUserClick}
                    onReport={(c: any) => setReportComment(c)}
                    onLike={(id: string, likes: string[]) => handleLike(id, likes)}
                  />
                  
                  {/* Replies Section */}
                  {replies.length > 0 && (
                    <div className="ml-8 md:ml-14 border-l border-white/5 pl-6 mt-6 space-y-6">
                      <button 
                        onClick={() => toggleReplies(comment.id)}
                        className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors group/view"
                      >
                        <div className="w-6 h-[1px] bg-white/10 group-hover/view:bg-red-500/50 transition-colors" />
                        {isExpanded ? "Hide Replies" : `View ${replies.length} Replies`}
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                          <ChevronDown className="w-3 h-3" />
                        </motion.div>
                      </button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <div className="space-y-6">
                            {replies.map(reply => (
                              <motion.div
                                key={reply.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                              >
                                <CommentItem 
                                  comment={reply}
                                  user={user}
                                  isAdmin={isAdmin}
                                  onDelete={handleDelete}
                                  onReply={() => setReplyTo(comment)} // Reply to parent
                                  onUserClick={onUserClick}
                                  onReport={(c: any) => setReportComment(c)}
                                  onLike={(id: string, likes: string[]) => handleLike(id, likes)}
                                  isReply
                                />
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </AnimatePresence>
          {comments.filter(c => !c.parentId).length > limitCount && (
            <div className="flex justify-center mt-10 w-full relative">
               <div className="absolute inset-x-0 top-1/2 -mt-[1px] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
               <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLimitCount(prev => prev + 10)}
                className="relative z-10 px-8 py-3 rounded-xl bg-[#000000] hover:bg-[#111] border border-white/10 text-white/70 hover:text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(0,0,0,0.8)] hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] flex items-center gap-3"
               >
                 <ChevronDown className="w-4 h-4 text-red-500" />
                 See More
               </motion.button>
            </div>
          )}
        </div>
      </div>


      {/* Reply Modal */}
      <AnimatePresence>
        {replyTo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#000000] border border-white/10 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-500 rounded-t-full" />
              <h3 className="text-xl font-black text-white mb-4">Reply to {replyTo.userName}</h3>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-6">
                <p className="text-xs text-white/40 italic line-clamp-2">"{replyTo.text}"</p>
              </div>
              <textarea
                value={replyTo.replyText || ""}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 100) val = val.slice(0, 100);
                  setReplyTo({ ...replyTo, replyText: val });
                }}
                placeholder="Write your reply..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-orange-500/50 transition-all resize-none outline-none mb-6"
                rows={4}
                autoFocus
                maxLength={100}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setReplyTo(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/40 text-xs font-medium hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePost(replyTo.id)}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-black shadow-lg shadow-red-900/40"
                >
                  Post Reply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportComment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#000000] border border-white/10 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-red-500 rounded-t-full" />
              
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    Report Comment
                  </h3>
                  <p className="text-sm text-white/40 mt-1">
                    Help us keep the community safe.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setReportComment(null);
                    setReportReason("");
                    setCustomReason("");
                    setReportSuccess(false);
                  }}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reportSuccess ? (
                <div className="py-8 text-center bg-white/5 rounded-2xl border border-white/5">
                  <BadgeCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-lg font-medium text-white">Report Submitted</h4>
                  <p className="text-sm text-white/40">Thank you. Admins will review this.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-6">
                    <span className="text-xs font-medium text-white/50 block mb-1">
                      {reportComment.userName}'s comment:
                    </span>
                    <p className="text-sm text-white/80 italic line-clamp-3">"{reportComment.text}"</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    {["Harassment / Toxic", "Spam / Ads", "Hate Speech", "Spoiler without warning", "Other"].map((reason) => (
                      <label key={reason} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer transition-all">
                        <input 
                          type="radio" 
                          name="reportReason" 
                          value={reason}
                          checked={reportReason === reason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className="text-sm font-medium text-white/80">{reason}</span>
                      </label>
                    ))}

                    <AnimatePresence>
                      {reportReason === "Other" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <textarea
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Tuliskan keluhan anda (opsional)..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-yellow-500/50 outline-none resize-none mt-2"
                            rows={2}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setReportComment(null);
                        setReportReason("");
                        setCustomReason("");
                      }}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReport}
                      disabled={isReporting || !reportReason}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-xs shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                    >
                      {isReporting ? "Sending..." : "Submit Report"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentItem({ comment, user, isAdmin, onDelete, onReply, onReport, onLike, onUserClick, isReply }: any) {
  const likesCount = comment.likes?.length || 0;
  const isLiked = user?.uid && comment.likes?.includes(user.uid);
  const formattedLikes = Intl.NumberFormat('en-US', { notation: "compact" }).format(likesCount);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 group/comment ${isReply ? "scale-95 origin-left" : ""}`}
    >
      <button 
        onClick={() => onUserClick?.(comment.uid)}
        className="w-9 h-9 rounded-full border border-white/10 shrink-0 overflow-hidden hover:scale-110 transition-all shadow-lg"
      >
        <img 
          src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.uid}`} 
          className="w-full h-full object-cover" 
          alt="Avatar"
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
            <span className={`notranslate text-sm font-medium leading-none border-b border-transparent hover:border-orange-500/50 transition-all cursor-pointer ${comment.userTiers?.includes("viyie_plus") ? "animate-gold-shine font-black" : "text-white"}`} onClick={() => onUserClick?.(comment.uid)} translate="no">{comment.userName}</span>
            <TierBadges tiers={comment.userTiers} title={comment.userBadgeTitle} />
            <span className="text-[10px] text-white/20 ml-1">
              {comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleString() : "Just now"}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-all">
            <button
              onClick={() => onLike(comment.id, comment.likes || [])}
              className={`p-1.5 flex items-center gap-1.5 transition-colors ${isLiked ? 'text-orange-500' : 'text-white/30 hover:text-orange-500'}`}
              title="Like"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              {likesCount > 0 && <span className="text-[10px] font-medium">{formattedLikes}</span>}
            </button>
            <button
              onClick={onReply}
              className="p-1.5 text-white/30 hover:text-orange-500 transition-colors"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReport(comment)}
              className="p-1.5 text-white/30 hover:text-yellow-500 transition-colors"
              title="Report Comment"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
            {((user?.uid && comment.uid === user.uid) || isAdmin) && (
              <button
                onClick={() => onDelete(comment.id, comment.timestamp, comment.uid)}
                className="p-1.5 text-white/30 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p translate="no" className={`notranslate text-sm leading-relaxed whitespace-pre-wrap ${
          comment.userTiers?.includes("viyie_plus") 
            ? "text-gold-glow font-medium" 
            : comment.uid === user?.uid 
              ? "text-orange-200/90" 
              : "text-white/70"
        }`}>
          {comment.text.split(/(\b\d{1,2}:\d{2}(?::\d{2})?\b)|(@[\w.]+)/g).map((part: string, i: number) => {
            if (!part) return null;
            if (part.match(/^\d{1,2}:\d{2}(?::\d{2})?$/)) {
              return <span key={i} className="text-blue-400 font-medium px-1 py-0.5 bg-blue-500/10 rounded cursor-pointer">{part}</span>;
            }
            if (part.startsWith("@")) {
              return <span key={i} className="text-red-500 font-medium">{part}</span>;
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>
    </motion.div>
  );
}
