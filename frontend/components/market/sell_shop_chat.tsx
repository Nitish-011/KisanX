"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Lock,
  CheckCheck,
  Building,
  ShieldCheck,
  TrendingUp,
  X,
  Sparkles,
  DollarSign,
  ChevronRight,
  Clock,
} from "lucide-react";

interface NegotiationMessage {
  id: string;
  listing_id: string;
  sender_role: "buyer" | "farmer";
  sender_name: string;
  proposed_price?: number | null;
  message: string;
  timestamp: string;
  status: string;
  encryption_hash?: string;
}

interface ChatThread {
  listing_id: string;
  crop_name: string;
  variety: string;
  farm_name: string;
  farmer_name: string;
  buyer_name: string;
  quality_grade: string;
  price_per_quintal: number;
  estimated_weight_quintals: number;
  last_message: string;
  last_timestamp: string;
  last_sender_role: string;
  latest_proposed_price?: number | null;
  status: string;
  messages_count: number;
  unread: boolean;
}

interface SellShopChatProps {
  activeRole: "farmer" | "buyer";
  selectedListingId?: string | null;
  language: "en" | "hi" | "mr";
  onClose?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SellShopChat({
  activeRole,
  selectedListingId,
  language,
  onClose,
}: SellShopChatProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeListingId, setActiveListingId] = useState<string | null>(selectedListingId || null);
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [listingDetails, setListingDetails] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [counterPrice, setCounterPrice] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Translations
  const t = {
    sellShopTitle: {
      en: "SELL SHOP • Direct Trade Chat",
      hi: "सेल शॉप • सीधा व्यापार वार्तालाप",
      mr: "सेल शॉप • थेट व्यापार संवाद",
    },
    activeDeals: {
      en: "Active Inquiries & Bids",
      hi: "सक्रिय बोलियां एवं पूछताछ",
      mr: "सक्रिय वाटाघाटी व बोली",
    },
    noThreads: {
      en: "No active conversations yet.",
      hi: "अभी कोई सक्रिय वार्तालाप नहीं है।",
      mr: "अद्याप कोणतेही संभाषण नाही.",
    },
    selectThread: {
      en: "Select a conversation to start negotiating.",
      hi: "बातचीत शुरू करने के लिए कोई सौदा चुनें।",
      mr: "संभाषण सुरू करण्यासाठी निवड करा.",
    },
    askingRate: {
      en: "Base Rate",
      hi: "आधार भाव",
      mr: "मूळ भाव",
    },
    proposedRate: {
      en: "Proposed Rate",
      hi: "प्रस्तावित भाव",
      mr: "प्रस्तावित दर",
    },
    acceptOffer: {
      en: "Accept Rate",
      hi: "भाव स्वीकारें",
      mr: "दर स्वीकारा",
    },
    counterRateLabel: {
      en: "Counter ₹/Qtl",
      hi: "काउंटर भाव ₹/क्विंटल",
      mr: "प्रति-दर ₹/क्विंटल",
    },
    placeholderMsg: {
      en: "Type your trade term or inquiry...",
      hi: "अपना संदेश या व्यापार शर्तें लिखें...",
      mr: "तुमचा संदेश किंवा अटी लिहा...",
    },
    sendBtn: {
      en: "Send",
      hi: "भेजें",
      mr: "पाठवा",
    },
    encryptedTag: {
      en: "256-bit Encrypted Trade Channel",
      hi: "256-बिट एन्क्रिप्टेड व्यापार चैनल",
      mr: "256-बिट सुरक्षित व्यवहार चॅनेल",
    },
    lotDetails: {
      en: "Lot Details",
      hi: "फसल विवरण",
      mr: "शेतमाल तपशील",
    },
  };

  // Fetch threads for current role
  async function fetchThreads() {
    try {
      setLoadingThreads(true);
      const res = await fetch(`${API_URL}/api/marketplace/sell-shop/threads?role=${activeRole}`);
      if (!res.ok) throw new Error("Failed to load threads");
      const data = await res.json();
      setThreads(data.threads || []);

      // If active listing not set, select first
      if (!activeListingId && (data.threads || []).length > 0) {
        setActiveListingId(data.threads[0].listing_id);
      }
    } catch (err) {
      console.warn("Sell shop threads fallback notice:", err);
      // Demo threads fallback
      const fallbackThreads: ChatThread[] = [
        {
          listing_id: "list-001",
          crop_name: "Sugarcane",
          variety: "Co 86032 (Nira)",
          farm_name: "Shivaji Krishi Estate",
          farmer_name: "Rameshwar Patil",
          buyer_name: "Shree Chhatrapati Sugar Mill",
          quality_grade: "Grade A",
          price_per_quintal: 365,
          estimated_weight_quintals: 2850,
          last_message: "We can procure the full 2,850 quintals lot with direct mill logistics pickup.",
          last_timestamp: "2026-09-08 16:45 IST",
          last_sender_role: "buyer",
          latest_proposed_price: 360,
          status: "COUNTER_OFFER",
          messages_count: 1,
          unread: activeRole === "farmer",
        },
      ];
      setThreads(fallbackThreads);
      if (!activeListingId) {
        setActiveListingId("list-001");
      }
    } finally {
      setLoadingThreads(false);
    }
  }

  // Fetch messages for active listing
  async function fetchMessages(listingId: string) {
    try {
      setLoadingMessages(true);
      const res = await fetch(`${API_URL}/api/marketplace/sell-shop/messages?listing_id=${listingId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data.messages || []);
      setListingDetails(data.listing || null);
    } catch (err) {
      console.warn("Sell shop messages fallback notice:", err);
      if (listingId === "list-001") {
        setListingDetails({
          id: "list-001",
          crop_name: "Sugarcane",
          variety: "Co 86032",
          farmer_name: "Rameshwar Patil",
          farm_name: "Shivaji Krishi Estate",
          village: "Baramati",
          district: "Pune, Maharashtra",
          quality_grade: "Grade A",
          price_per_quintal: 365,
          estimated_weight_quintals: 2850,
          total_valuation: 1040250,
          inspector_status: "CERTIFIED_GRADE_A",
          encryption_fingerprint: "0x8f19e4c3a2b75019d44f",
        });
        setMessages([
          {
            id: "neg-101",
            listing_id: "list-001",
            sender_role: "buyer",
            sender_name: "Shree Chhatrapati Sugar Mill",
            proposed_price: 360,
            message: "We can procure the full 2,850 quintals lot with direct mill logistics pickup.",
            timestamp: "2026-09-08 16:45 IST",
            status: "COUNTER_OFFER",
            encryption_hash: "0x3e7b1a9f04c6d882",
          },
        ]);
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    fetchThreads();
  }, [activeRole]);

  useEffect(() => {
    if (activeListingId) {
      fetchMessages(activeListingId);
    }
  }, [activeListingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(presetPrice?: number) {
    const textToSend = chatMessage.trim() || (presetPrice ? `I accept the proposed rate of ₹${presetPrice}/Quintal.` : "");
    if (!textToSend || !activeListingId) return;

    try {
      setSending(true);
      const priceVal = presetPrice !== undefined ? presetPrice : counterPrice ? parseInt(counterPrice) : null;
      const senderName = activeRole === "farmer" ? "Farmer (Verified Seller)" : "APMC Commodity Buyer";

      const res = await fetch(`${API_URL}/api/marketplace/sell-shop/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: activeListingId,
          sender_role: activeRole,
          sender_name: senderName,
          proposed_price: priceVal,
          message: textToSend,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages(data.all_negotiations || []);
      setChatMessage("");
      setCounterPrice("");
      fetchThreads();
    } catch (err: any) {
      alert(err.message || "Could not deliver message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#070b08] text-white shadow-2xl backdrop-blur-2xl">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-black font-black shadow-lg shadow-emerald-500/20">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {t.sellShopTitle[language]}
              </h2>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                Direct DM
              </span>
            </div>
            <p className="text-[11px] text-white/50 flex items-center gap-1.5 mt-0.5">
              <Lock size={10} className="text-emerald-400" />
              {t.encryptedTag[language]}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* TWO-PANE INSTAGRAM DM LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px] max-h-[620px]">
        {/* LEFT COLUMN: ACTIVE CONVERSATIONS */}
        <div className="md:col-span-4 border-r border-white/10 overflow-y-auto p-3 space-y-2 bg-black/40">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            {t.activeDeals[language]}
          </div>

          {loadingThreads ? (
            <div className="p-6 text-center text-xs text-white/40">Loading chats...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40">{t.noThreads[language]}</div>
          ) : (
            threads.map((th) => {
              const isSelected = th.listing_id === activeListingId;
              const counterpart = activeRole === "farmer" ? th.buyer_name : th.farmer_name;

              return (
                <button
                  key={th.listing_id}
                  type="button"
                  onClick={() => setActiveListingId(th.listing_id)}
                  className={`w-full text-left rounded-2xl p-3 transition flex items-start gap-3 border ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-950/30 text-white shadow-lg shadow-emerald-950/20"
                      : "border-transparent bg-white/[0.02] hover:bg-white/[0.05] text-white/80"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-base font-bold">
                    {th.crop_name === "Cotton" ? "🌿" : "🎋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white truncate">{counterpart}</p>
                      {th.unread && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-400/90 font-medium truncate">
                      {th.crop_name} • {th.variety}
                    </p>
                    <p className="text-[11px] text-white/40 truncate mt-0.5">
                      {th.last_message}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT FEED */}
        <div className="md:col-span-8 flex flex-col justify-between bg-black/20">
          {activeListingId && listingDetails ? (
            <>
              {/* CHAT HEADER: LOT CARD BAR */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-white/[0.02]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {listingDetails.crop_name} ({listingDetails.variety || "Harvest Lot"})
                    </span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      {listingDetails.quality_grade}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50">
                    {listingDetails.farm_name} • {listingDetails.district} • {listingDetails.estimated_weight_quintals} Qtl
                  </p>
                </div>

                <div className="text-right font-mono">
                  <p className="text-[10px] text-white/40">{t.askingRate[language]}</p>
                  <p className="text-xs font-black text-emerald-400">
                    ₹{listingDetails.price_per_quintal} / Qtl
                  </p>
                </div>
              </div>

              {/* MESSAGES TIMELINE */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 max-h-[380px]">
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-white/40">Loading encrypted messages...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-white/40">
                    Start the negotiation by proposing a price or sending a message.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.sender_role === activeRole;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-white/40 px-2 mb-1">
                          {msg.sender_name} • {msg.timestamp}
                        </span>

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-3xl px-4 py-3 text-xs leading-relaxed shadow-md ${
                            isSelf
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-black font-medium rounded-br-sm"
                              : "bg-white/10 text-white rounded-bl-sm border border-white/10 backdrop-blur-md"
                          }`}
                        >
                          {/* Price Proposal Card inside message */}
                          {msg.proposed_price && (
                            <div className="mb-2 rounded-2xl bg-black/30 border border-white/20 p-2.5 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase font-bold text-emerald-300">
                                  {t.proposedRate[language]}
                                </p>
                                <p className="text-sm font-black font-mono text-white">
                                  ₹{msg.proposed_price} / Quintal
                                </p>
                              </div>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleSendMessage(msg.proposed_price!)}
                                  className="rounded-xl bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-black hover:bg-emerald-300 transition"
                                >
                                  {t.acceptOffer[language]}
                                </button>
                              )}
                            </div>
                          )}

                          <p className={isSelf ? "text-black" : "text-white"}>{msg.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT BAR: PROPOSED PRICE + MESSAGE INPUT */}
              <div className="border-t border-white/10 p-3 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="w-32">
                    <input
                      type="number"
                      value={counterPrice}
                      onChange={(e) => setCounterPrice(e.target.value)}
                      placeholder={t.counterRateLabel[language]}
                      className="w-full rounded-2xl border border-white/15 bg-black/60 px-3 py-2.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>

                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={t.placeholderMsg[language]}
                    className="flex-1 rounded-2xl border border-white/15 bg-black/60 px-4 py-2.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-400"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={sending || (!chatMessage.trim() && !counterPrice)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black hover:bg-emerald-400 transition disabled:opacity-40 font-bold shadow-lg shadow-emerald-500/20"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white/40">
              <MessageSquare size={36} className="mb-2 opacity-40" />
              <p className="text-xs">{t.selectThread[language]}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
