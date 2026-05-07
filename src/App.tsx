/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shirt, 
  User, 
  Image as ImageIcon, 
  Home, 
  Plus, 
  LogOut, 
  RefreshCcw, 
  Check, 
  Trash2,
  ChevronRight,
  Maximize2,
  Sparkles,
  Upload,
  CheckCircle2,
  Circle,
  Loader2,
  Settings2,
  Footprints,
  ShoppingBag,
  Gem,
  AlignJustify,
  Palette,
  X,
  Layers
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from '@google/genai';
import { UserType, ItemCategory, ClothingItem, StylingPlan } from './types';
import { MOCK_ITEMS, APP_CONFIG } from './constants';
import { fileToBase64, processClothingImage } from './lib/imageUtils';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const cleanDescription = (desc: string) => {
  return desc
    .replace(/(?:使用建议)?ID[:\s]*\[(.*?)\]/g, '')
    .replace(/.*使用建议ID.*/g, '')
    .trim();
};

function parseColors(text: string): { name: string, hex: string }[] {
  const colors: { name: string, hex: string }[] = [];
  
  const pattern1 = /\[(#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3}))\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    colors.push({ hex: match[1], name: match[2] });
  }

  if (colors.length === 0) {
    const pattern2 = /(#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3}))(?:\s*[(（]([^)）]+)[)）])?/g;
    while ((match = pattern2.exec(text)) !== null) {
      if (!colors.some(c => c.hex === match[1])) {
          colors.push({ hex: match[1], name: match[2] || '主要颜色' });
      }
    }
  }

  if (colors.length === 0) {
    const knownColors = ['粉色', '白色', '黑色', '蓝色', '黄色', '绿色', '紫色', '红色', '灰色', '棕色', '橙色', '米色', '卡其色', '咖色', '银色', '金色', '藏青色'];
    const map: Record<string, string> = {
      '粉色': '#FFC0CB', '白色': '#FFFFFF', '黑色': '#000000', '蓝色': '#0000FF',
      '黄色': '#FFFF00', '绿色': '#008000', '紫色': '#800080', '红色': '#FF0000', '灰色': '#808080',
      '棕色': '#A52A2A', '橙色': '#FFA500', '米色': '#F5F5DC', '卡其色': '#F0E68C', '咖色': '#6F4E37', '银色': '#C0C0C0', '金色': '#FFD700', '藏青色': '#000080'
    };
    for (const name of knownColors) {
      if (text.includes(name)) {
        colors.push({ name, hex: map[name] });
      }
    }
  }

  // Deduplicate by hex
  const unique = new Map<string, {name: string, hex: string}>();
  for (const c of colors) unique.set(c.hex, c);
  return Array.from(unique.values());
}

const PlanDescription = ({ description, hideItems = false }: { description: string, hideItems?: boolean }) => {
  let text = cleanDescription(description);
  
  if (hideItems) {
    text = text.replace(/【单品组合】([\s\S]*?)(?=【|$)/, '');
  }

  const colorMatch = text.match(/【色彩搭配】([\s\S]*?)(?=【|$)/);
  if (!colorMatch) return <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;

  const colorText = colorMatch[1];
  const colors = parseColors(colorText);

  const beforeText = text.substring(0, colorMatch.index);
  const afterText = text.substring(colorMatch.index! + colorMatch[0].length);

  return (
    <div className="flex flex-col gap-2 relative">
      {beforeText.trim() && (
        <div className="markdown-body">
          <Markdown remarkPlugins={[remarkGfm]}>{beforeText}</Markdown>
        </div>
      )}
      
      {colors.length > 0 ? (
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 my-2 relative">
          <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Palette size={14} className="text-brand-primary" /> 色彩搭配</h4>
          <div className="flex flex-wrap gap-2">
            {colors.map((c, i) => (
              <div key={`${c.hex}-${i}`} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-[10px] border border-gray-100 shadow-sm">
                <div className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: c.hex }} />
                <span className="text-[10px] font-bold text-gray-700">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="markdown-body">
          <Markdown remarkPlugins={[remarkGfm]}>{`【色彩搭配】\n${colorText}`}</Markdown>
        </div>
      )}

      {afterText.trim() && (
        <div className="markdown-body">
          <Markdown remarkPlugins={[remarkGfm]}>{afterText}</Markdown>
        </div>
      )}
    </div>
  );
};

const PlanSummaryCard = ({ plan, title, getItemById, customModelImage, onClick }: { plan: StylingPlan, title?: string, getItemById: (id: string) => ClothingItem | undefined, customModelImage?: string | null, onClick?: () => void }) => {
  const colors = parseColors(plan.description);
  const sceneMatch = plan.description.match(/【场景适配】([\s\S]*?)(?=【|$)/);
  let scene = '';
  if (sceneMatch) {
    scene = sceneMatch[1].replace(/[*#]/g, '').trim().split('\n')[0];
  }

  const combinationNames = [plan.mainItemId, ...plan.matchedItemIds]
    .map(id => getItemById(id)?.name)
    .filter(Boolean);

  return (
    <div 
      className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm cursor-pointer hover:border-brand-primary/50 transition-colors flex gap-4"
      onClick={onClick}
    >
      <div className="w-24 h-32 shrink-0 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 relative">
        <img 
          src={plan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} 
          className="w-full h-full object-cover" 
          alt="Fitting" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
            if (target.src !== fallback) target.src = fallback;
          }}
        />
        {!plan.fittingImage && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
            <div className="text-white text-[9px] font-medium text-center">内置模特</div>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col pt-1">
        <div className="flex justify-between items-start mb-2">
          <span className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase truncate max-w-[120px]">
            {title || plan.vibe}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 shrink-0">{new Date(parseInt(plan.id.split('-').pop() || '0')).toLocaleDateString()}</span>
        </div>
        
        {scene && (
          <div className="text-[11px] text-gray-600 mb-2 font-medium line-clamp-2 leading-relaxed">
            <span className="text-gray-400">场景：</span>{scene}
          </div>
        )}

        <div className="text-[11px] text-gray-600 mb-2 font-medium line-clamp-2 leading-relaxed">
          <span className="text-gray-400">单品：</span>{combinationNames.join(' + ')}
        </div>

        {colors.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {colors.slice(0, 3).map((c, i) => (
              <div key={`${c.hex}-${i}`} className="flex items-center gap-1 bg-gray-50 px-1.5 py-1 rounded-[8px] border border-gray-100 shadow-sm">
                <div className="w-2 h-2 rounded-full shadow-inner border border-gray-200" style={{ backgroundColor: c.hex }} />
                <span className="text-[9px] text-gray-500 whitespace-nowrap">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'TOPS': return <Shirt size={14} />;
    case 'BOTTOMS': return <AlignJustify size={14} />;
    case 'DRESSES': return <User size={14} />;
    case 'SHOES': return <Footprints size={14} />;
    case 'ACCESSORIES': return <Gem size={14} />;
    default: return <ShoppingBag size={14} />;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'TOPS': return '上衣';
    case 'BOTTOMS': return '下装';
    case 'DRESSES': return '连衣裙';
    case 'SHOES': return '鞋履';
    case 'ACCESSORIES': return '配饰';
    default: return '单品';
  }
};

const PlanCombinations = ({ plan, getItemById, handleItemClick, setActiveTab }: { plan: StylingPlan, getItemById: (id: string) => ClothingItem | undefined, handleItemClick: (item: ClothingItem) => void, setActiveTab: (t: any) => void }) => {
  const parsedTabs = useMemo(() => {
    const match = plan.description.match(/【单品组合】([\s\S]*?)(?=【|$)/);
    const sections = match ? match[1].split(/\n\s*-\s*/).filter(s => s.trim().length > 0) : [];
    
    const wardrobeItemsInPlan = [
      getItemById(plan.mainItemId), 
      ...plan.matchedItemIds.map(id => getItemById(id))
    ].filter(Boolean) as ClothingItem[];

    const usedWardrobeIds = new Set();

    const tabs = sections.map((sec, idx) => {
      const lines = sec.split('\n').map(l => l.trim()).filter(Boolean);
      let categoryLabel = '';
      let name = lines[0];
      const titleMatch = lines[0].match(/^(.*?)[：:](.*)$/);
      if (titleMatch) {
         categoryLabel = titleMatch[1].replace(/^[\s*-]+/, '').trim();
         name = titleMatch[2].trim();
      } else {
         const parts = lines[0].split(/[:：]/);
         categoryLabel = parts[0].replace(/^[\s*-]+/, '').trim();
         name = parts.slice(1).join(':').trim();
      }

      let extractedId = null;
      const idMatch = name.match(/ID[:：\s]*([a-zA-Z0-9_\-]+)/i);
      if (idMatch) {
         extractedId = idMatch[1];
         name = name.replace(/\(ID[:：\s]*[a-zA-Z0-9_\-]+\)/i, '').trim();
      }

      const details = { design: '', quality: '', fit: '' };
      
      lines.slice(1).forEach(l => {
        if (l.includes('品类/设计')) details.design = l.replace(/^[-*]+?\s*品类\/设计[：:]?\s*/, '').trim();
        else if (l.includes('品质/搭配')) details.quality = l.replace(/^[-*]+?\s*品质\/搭配(关系)?[：:]?\s*/, '').trim();
        else if (l.includes('版型/舒适')) details.fit = l.replace(/^[-*]+?\s*版型\/舒适(度)?[/\\]?(便利性)?[：:]?\s*/, '').trim();
      });

      let wItem = null;
      if (extractedId) {
         wItem = wardrobeItemsInPlan.find(i => i.id === extractedId);
      }
      if (!wItem) {
        wItem = wardrobeItemsInPlan.find(w => {
           if (usedWardrobeIds.has(w.id)) return false;
           const catL = getCategoryLabel(w.category);
           return categoryLabel.includes(catL) || catL.includes(categoryLabel);
        });
      }
      
      if (wItem) usedWardrobeIds.add(wItem.id);

      return {
         id: `virtual-${idx}`,
         categoryLabel,
         name,
         details,
         wardrobeItem: wItem,
         standardCategory: wItem ? wItem.category : (categoryLabel.includes('鞋') ? 'SHOES' : categoryLabel.includes('配饰') ? 'ACCESSORIES' : 'TOPS')
      };
    });

    wardrobeItemsInPlan.forEach(wItem => {
      if (!usedWardrobeIds.has(wItem.id)) {
         tabs.push({
           id: `fallback-${wItem.id}`,
           categoryLabel: getCategoryLabel(wItem.category),
           name: wItem.name,
           details: { design: wItem.description, quality: '', fit: '' },
           wardrobeItem: wItem,
           standardCategory: wItem.category
         });
      }
    });

    return tabs;
  }, [plan, getItemById]);

  const [activeId, setActiveId] = useState(parsedTabs[0]?.id);
  
  useEffect(() => {
    setActiveId(parsedTabs[0]?.id);
  }, [parsedTabs]);

  const activeTab = parsedTabs.find(t => t.id === activeId) || parsedTabs[0];

  if (parsedTabs.length === 0) return null;

  return (
    <div className="mt-8 mb-6">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        组合方案 <span className="text-xs text-gray-400 font-normal ml-2">选择品类查看单品信息与搭配建议</span>
      </h3>
      
      {/* Category Formula */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-gray-50 p-3 rounded-2xl">
        {parsedTabs.map((tab, idx) => (
          <div key={`formula-${tab.id}`} className="flex items-center gap-2">
            {idx > 0 && <Plus size={12} className="text-gray-400" />}
            <span className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-full ${tab.wardrobeItem ? 'text-brand-primary bg-brand-primary/10' : 'text-orange-500 bg-orange-50'}`}>
              {getCategoryIcon(tab.standardCategory)}
              {tab.categoryLabel || getCategoryLabel(tab.standardCategory)}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {parsedTabs.map(tab => (
          <button
            key={`tabbtn-${tab.id}`}
            onClick={() => setActiveId(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeId === tab.id 
                ? 'bg-black text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-300'
            }`}
          >
            {getCategoryIcon(tab.standardCategory)}
             {tab.categoryLabel || getCategoryLabel(tab.standardCategory)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab && (
         <motion.div 
         key={activeTab.id}
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         className="mt-3 bg-white p-5 rounded-2xl border border-gray-100 flex flex-col gap-4 shadow-sm"
       >
         <div className="flex gap-4 items-start">
           {activeTab.wardrobeItem ? (
             <button 
               onClick={() => handleItemClick(activeTab.wardrobeItem!)}
               className="w-20 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 relative group active:scale-95 transition-transform"
             >
               <img src={activeTab.wardrobeItem.imageUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                 <Maximize2 size={16} className="text-white" />
               </div>
               {activeTab.wardrobeItem.id === plan.mainItemId && (
                 <div className="absolute bottom-1 left-1 right-1 text-center bg-brand-primary text-white text-[8px] font-bold py-0.5 rounded-sm">主件</div>
               )}
             </button>
           ) : (
             <div className="w-20 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-200 border-dashed flex flex-col items-center justify-center gap-1">
               {getCategoryIcon(activeTab.standardCategory)}
               <span className="text-[10px] text-gray-400 text-center px-1">库中暂无<br/>建议添加</span>
             </div>
           )}
           
           <div className="flex-1">
             <div className="flex justify-between items-start">
               <div>
                  <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{activeTab.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{activeTab.wardrobeItem ? '库中单品' : 'AI推荐搭配'}</p>
               </div>
               {activeTab.wardrobeItem?.brand && <span className="text-[10px] text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded">{activeTab.wardrobeItem.brand}</span>}
             </div>
             
             {!activeTab.wardrobeItem && (
                <button 
                  onClick={() => setActiveTab('wardrobe')}
                  className="mt-3 text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> 去衣柜添加
                </button>
             )}
           </div>
         </div>

         <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-1">
            {activeTab.details.design && (
              <div className="text-xs">
                <span className="font-bold text-gray-700 block mb-1">品类与设计</span>
                <p className="text-gray-600 leading-relaxed">{activeTab.details.design}</p>
              </div>
            )}
            {activeTab.details.quality && (
              <div className="text-xs border-t border-gray-200/60 pt-3">
                <span className="font-bold text-gray-700 block mb-1">品质与搭配关系</span>
                <p className="text-gray-600 leading-relaxed">{activeTab.details.quality}</p>
              </div>
            )}
            {activeTab.details.fit && (
              <div className="text-xs border-t border-gray-200/60 pt-3">
                <span className="font-bold text-gray-700 block mb-1">版型/舒适度/便利性</span>
                <p className="text-gray-600 leading-relaxed">{activeTab.details.fit}</p>
              </div>
            )}
            {!activeTab.details.design && !activeTab.details.quality && !activeTab.details.fit && (
              <div className="text-xs text-gray-500 py-2 text-center border border-dashed border-gray-200 rounded-lg">
                暂无详细分析内容
              </div>
            )}
         </div>

       </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<{ type: UserType | null; name: string }>({ type: null, name: '' });
  const [activeTab, setActiveTabState] = useState<'home' | 'styling' | 'wardrobe' | 'profile' | 'plans' | 'planDetail' | 'assets' | 'tuning'>('home');
  const [previousTab, setPreviousTab] = useState<'home' | 'styling' | 'wardrobe' | 'profile' | 'plans' | 'planDetail' | 'assets' | 'tuning'>('home');
  
  const setActiveTab = (tab: typeof activeTab) => {
    setPreviousTab(activeTab);
    setActiveTabState(tab);
  };

  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [filterItemId, setFilterItemId] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<StylingPlan | null>(null);
  const [stylingPlans, setStylingPlans] = useState<StylingPlan[]>([]);
  
  const [currentGenerationPlans, setCurrentGenerationPlans] = useState<StylingPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [tuningPlan, setTuningPlan] = useState<StylingPlan | null>(null);
  const [tuningInput, setTuningInput] = useState<string>('');
  const [tuningReferenceImage, setTuningReferenceImage] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [backgroundStylingTasks, setBackgroundStylingTasks] = useState<Set<string>>(new Set());
  const [backgroundStylingNames, setBackgroundStylingNames] = useState<string[]>([]);
  const [assets, setAssets] = useState<string[]>([]);
  const [notebookCover, setNotebookCover] = useState<string | null>(null);
  const [notebookText, setNotebookText] = useState<string>('');
  const [notebookPrompt, setNotebookPrompt] = useState<string>('');
  const [isGeneratingNotebookText, setIsGeneratingNotebookText] = useState<boolean>(false);
  const [isGeneratingMoreAssets, setIsGeneratingMoreAssets] = useState<boolean>(false);
  const [fittingImage, setFittingImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [hasGeneratedCurrentPlan, setHasGeneratedCurrentPlan] = useState(false);
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);

  // Wardrobe states
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>(MOCK_ITEMS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [identifyingItemIds, setIdentifyingItemIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const [globalItemsDict, setGlobalItemsDict] = useState<Record<string, ClothingItem>>(() => {
    const saved = localStorage.getItem('kidstyle_global_items_dict');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    const dict: Record<string, ClothingItem> = {};
    for (const item of MOCK_ITEMS) dict[item.id] = item;
    return dict;
  });

  const updateGlobalDict = (newItems: ClothingItem[]) => {
    setGlobalItemsDict(prev => {
      const next = { ...prev };
      let changed = false;
      for (const item of newItems) {
        if (JSON.stringify(next[item.id]) !== JSON.stringify(item)) {
          next[item.id] = item;
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem('kidstyle_global_items_dict', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  };

  useEffect(() => {
    updateGlobalDict(wardrobeItems);
  }, [wardrobeItems]);

  const getItemById = (id: string): ClothingItem | undefined => {
    return globalItemsDict[id];
  };

  const getActiveWardrobeItems = (): ClothingItem[] => {
    let all: ClothingItem[] = [];
    const parentWardrobeStr = localStorage.getItem('kidstyle_wardrobe_PARENT');
    const storeWardrobeStr = localStorage.getItem('kidstyle_wardrobe_STORE_OWNER');
    
    if (parentWardrobeStr) {
      try { all = all.concat(JSON.parse(parentWardrobeStr)); } catch (e) {}
    }
    if (storeWardrobeStr) {
      try { all = all.concat(JSON.parse(storeWardrobeStr)); } catch (e) {}
    }
    if (!parentWardrobeStr && !storeWardrobeStr) {
      all = [...MOCK_ITEMS];
    }
    
    const map = new Map<string, ClothingItem>();
    for (const i of all) map.set(i.id, i);
    for (const i of wardrobeItems) map.set(i.id, i);
    return Array.from(map.values()).filter(i => i.isIdentified !== false);
  };

  const [dataUserType, setDataUserType] = useState<UserType | null>(null);

  useEffect(() => {
    if (user.type && user.type !== dataUserType) {
      const savedWardrobe = localStorage.getItem(`kidstyle_wardrobe_${user.type}`);
      if (savedWardrobe) {
        try { setWardrobeItems(JSON.parse(savedWardrobe)); } catch(e) { setWardrobeItems(MOCK_ITEMS); }
      } else {
        setWardrobeItems(MOCK_ITEMS);
      }
      
      const savedPlans = localStorage.getItem(`kidstyle_plans_${user.type}`);
      if (savedPlans) {
         try { setStylingPlans(JSON.parse(savedPlans)); } catch(e) { setStylingPlans([]); }
      } else {
         setStylingPlans([]);
      }

      const savedModel = localStorage.getItem(`kidstyle_model_${user.type}`);
      setCustomModelImage(savedModel || null);

      setDataUserType(user.type);
    }
  }, [user.type, dataUserType]);

  useEffect(() => {
    if (user.type && user.type === dataUserType) {
      localStorage.setItem(`kidstyle_wardrobe_${user.type}`, JSON.stringify(wardrobeItems));
    }
  }, [wardrobeItems, dataUserType, user.type]);

  useEffect(() => {
    if (user.type && user.type === dataUserType) {
      localStorage.setItem(`kidstyle_plans_${user.type}`, JSON.stringify(stylingPlans));
    }
  }, [stylingPlans, dataUserType, user.type]);

  useEffect(() => {
    if (user.type && user.type === dataUserType) {
      if (customModelImage) {
        localStorage.setItem(`kidstyle_model_${user.type}`, customModelImage);
      } else {
        localStorage.removeItem(`kidstyle_model_${user.type}`);
      }
    }
  }, [customModelImage, dataUserType, user.type]);

  const analyzeItem = async (item: ClothingItem) => {
    if (item.isIdentified) return;
    
    setIdentifyingItemIds(prev => new Set(prev).add(item.id));
    try {
      let base64Data = item.imageUrl;
      // If it's a blob url or external url, we need to fetch it to get base64. 
      // But we already converted uploads to base64! Let's handle both.
      if (!base64Data.startsWith('data:')) {
        const response = await fetch(item.imageUrl);
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const prompt = `你是一位童装时尚分析专家。请分析这张图片中的单品，并返回严格的JSON格式数据，不要有任何其他文字或Markdown格式标记。
JSON需要包含以下字段：
{
  "name": "简短的商品名称（例如：碎花连体裙）",
  "category": "必须是以下之一：TOPS, BOTTOMS, DRESSES, ACCESSORIES, SHOES",
  "brand": "你识别出的品牌，如果没有明显标识可以填未知或建议的常见品牌",
  "description": "一段10-20字的商品特征描述",
  "style": "单品的风格（例如：田园风，运动风，休闲风）",
  "tags": ["标签1", "标签2", "标签3", "标签4"]
}`;

      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data.split(',')[1],
              mimeType: base64Data.split(';')[0].split(':')[1] || 'image/jpeg'
            }
          }
        ]
      });

      const jsonStr = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      const updatedItem = {
        ...item,
        name: parsed.name || item.name,
        category: parsed.category as ItemCategory || item.category,
        brand: parsed.brand || item.brand,
        description: parsed.description || item.description,
        style: parsed.style,
        tags: parsed.tags || [],
        isIdentified: true
      };

      setWardrobeItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
      setSelectedItem(curr => curr?.id === item.id ? updatedItem : curr);
    } catch (error) {
      console.error('Failed to identify item:', error);
      
      // Fallback on error (e.g. quota limits)
      const fallbackItem = {
        ...item,
        name: "默认服饰",
        brand: user.type === UserType.STORE_OWNER ? APP_CONFIG.BRAND_PRIORITY : '未命名品牌',
        description: "AI 识别受限，使用默认属性",
        style: "休闲风",
        tags: ["休闲", "百搭", "日常"],
        isIdentified: true
      };
      setWardrobeItems(prev => prev.map(i => i.id === item.id ? fallbackItem : i));
      setSelectedItem(curr => curr?.id === item.id ? fallbackItem : curr);
      alert('AI 识别受限或失败，已使用默认属性填充。请稍后再试或检查额度。');
    } finally {
      setIdentifyingItemIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const enterCreationHub = (targetItem?: ClothingItem) => {
    setActiveTab('styling');
    setFilterItemId(null);
    setHasGeneratedCurrentPlan(false);
    setCurrentGenerationPlans([]);
    
    if (targetItem) {
      setSelectedItem(targetItem);
    } else {
      setSelectedItem(null);
    }
  };

  const handleItemClick = (item: ClothingItem) => {
    // Identify item if it hasn't been identified yet
    if (!item.isIdentified) {
      if (!identifyingItemIds.has(item.id)) {
        analyzeItem(item);
      }
      return; // Do not switch to plans tab if not identified
    }

    setFilterItemId(item.id);
    setActiveTab('plans');
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    e.target.value = ''; // Reset input so same file can be uploaded again if needed

    const newItems: ClothingItem[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const base64 = await processClothingImage(file);
            const newItem = {
                id: `uploaded-${Date.now()}-${i}`,
                name: file.name.split('.')[0],
                category: ItemCategory.TOPS, // Default, user can't change yet but it's a mock
                imageUrl: base64,
                brand: user.type === UserType.STORE_OWNER ? APP_CONFIG.BRAND_PRIORITY : '未命名品牌',
                description: '新上传的单品',
                isIdentified: false,
                createdAt: Date.now()
            };
            newItems.push(newItem);
        } catch (e) {
            console.error('Failed to encode image', e);
        }
    }

    setWardrobeItems(prev => [...prev, ...newItems]);
    setIsUploading(false);
    
    // Automatically trigger analysis for each uploaded item in the background
    newItems.forEach(item => {
      analyzeItem(item);
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    setWardrobeItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
    setSelectedItemIds(new Set());
    setIsEditMode(false);
  };

  // Function to generate 1 detailed lifestyle plan using Gemini (Parallel)
  const generateAIDescription = async (mainItem: ClothingItem, candidates: ClothingItem[], styleVibe: string) => {
    try {
      const prompt = `
        你是一位顶级童装时尚专家。请根据以下主打单品，为一位【${APP_CONFIG.DEFAULT_AGE}岁女孩】通过AI智能搭配，提供【1套】${styleVibe}风格的穿搭方案。
        
        主打单品：${mainItem.name} (ID: ${mainItem.id}, ${mainItem.brand}, ${mainItem.description})
        可选搭配库：${candidates.map(i => `${i.name}(ID:${i.id}, 分类:${i.category})`).join('、')}
        
        要求：
        1. 此方案需体现强烈的【${styleVibe}】风格特征，融入前沿穿搭趋势。
        2. 严格按要求使用的搭配单品（ID必须从可选库中选择）。如果可选搭配库没有合适的单品，你可以建议空缺，但对于选择了的单品ID，请必须包含。
        3. 请严格按照以下规范输出：

        【风格定位】
        明确核心风格。结合：鹅蛋脸/圆润脸型特征、自然发型、7-9岁女童活泼审美、家长对“好看且不过度成熟”的偏好。

        【单品组合】
        如果有库中适合的单品，请结合搭配库并在文末注明ID。如果库中没有合适的单品(特别是鞋履和配饰)，请用文字描述推荐的增广单品名称(如：建议搭配一双白色帆布鞋)，**绝对不要为了硬搭而选择库中不合适的单品**。
        对于每个搭配单品(无论是库中的还是文字建议的虚拟单品)，请严格按照以下格式提供换行拆解分析：
        - 类别名（如：上衣/下装/鞋履/配饰）：单品名称 (如果你选了库中的单品，请务必标记 ID:xxx)
          - 品类/设计：详细描述设计感、图案、颜色等
          - 品质/搭配关系：面料品质或与其他单品的搭配关系，如何提升整体质感
          - 版型/舒适度/便利性：版型信息、穿着舒适度、对小女孩的活动便利性

        文末必须包含一个提取出来的ID汇总，格式为：使用建议ID: [ID1, ID2, ...] (仅包含从可选库中挑选的ID，没有选其他库中单品则只挂主件ID或为空)

        【色彩搭配】
        明确主色与辅助色。结合：肤色适配、当季流行色、避免过度花哨，突出清新童真。
        格式要求：必须提取出重点颜色并附带HEX颜色码，使用逗号分隔，格式如：[#HEX码](颜色名), 例如：[#FFB6C1](浅粉色), [#FFFFFF](纯白色)。

        【配饰搭配】
        添加适合7-9岁女童的当季配饰。如果有在【单品组合】中提及，可简略说明。

        【场景适配】
        明确适合的当季场景。

        【补充说明】
        1句适配总结。
        1句避坑提示。

        请使用美观的Markdown格式输出。
      `;

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      
      return response.text || '';
    } catch (error) {
      console.error('Gemini error:', error);
      alert('AI 穿搭建议生成受限，请稍后再试或检查额度。');
      return '### AI 错误\n目前无法生成穿搭建议，请检查额度或网络状态。';
    }
  };

  const actualSelectedItem = selectedItem ? getItemById(selectedItem.id) || selectedItem : null;
  const isReadyToGenerate = actualSelectedItem && actualSelectedItem.isIdentified !== false;

  const handleGenerateStyling = async () => {
    if (!actualSelectedItem || actualSelectedItem.isIdentified === false) return;
    const generatingId = actualSelectedItem.id;
    const generatingName = actualSelectedItem.name;

    setBackgroundStylingTasks(prev => new Set(prev).add(generatingId));
    setBackgroundStylingNames(prev => [...prev, generatingName]);
    
    // Clear generation plans so that we see the loading state
    setCurrentGenerationPlans([]);
    setHasGeneratedCurrentPlan(false);
    setSelectedPlanIndex(0);
    
    try {
      const candidates = wardrobeItems.filter(i => i.id !== generatingId);
      const styles = ['日常休闲', '精致学院', '山系户外'];
      
      const promises = styles.map(async (styleVibe, idx) => {
        const desc = await generateAIDescription(actualSelectedItem, candidates, styleVibe);
        if (!desc.trim() || desc.length < 10) return;

        const matchedIds: string[] = [];
        const idMatch = desc.match(/(?:使用建议)?ID[^\n\[]*\[(.*?)\]/);
        const idString = idMatch ? idMatch[1] : desc;
        
        candidates.forEach(c => {
          const tokens = idString.split(/[^a-zA-Z0-9_\-]+/);
          if (tokens.includes(c.id)) {
            matchedIds.push(c.id);
          }
        });

        const newPlan = {
          id: `${generatingId}-${idx}-${Date.now()}`,
          mainItemId: generatingId,
          matchedItemIds: matchedIds.slice(0, 3), // AI might hallucinate IDs, guard it
          vibe: styleVibe,
          description: cleanDescription(desc)
        };

        // Stream output to state!
        setStylingPlans(prev => [newPlan, ...prev]);
        setCurrentGenerationPlans(prev => [...prev, newPlan]);
        setHasGeneratedCurrentPlan(true);    
      });

      await Promise.allSettled(promises);
      
    } catch (err) {
      console.error(err);
      alert('方案生成受限或失败，请稍后再试或检查您的API额度。');
    } finally {
      setBackgroundStylingTasks(prev => {
        const next = new Set(prev);
        next.delete(generatingId);
        return next;
      });
      setBackgroundStylingNames(prev => prev.filter(name => name !== generatingName));
    }
  };

  const handleUpdatePlanText = async () => {
    if (!tuningPlan || !tuningInput.trim()) return;
    setIsUpdatingPlan(true);
    
    try {
      const candidates = getActiveWardrobeItems().filter(i => i.id !== tuningPlan.mainItemId);
      const mainItem = getItemById(tuningPlan.mainItemId);
      if (!mainItem) return;

      const prompt = `
        你是一位顶级童装时尚专家。这是当前的穿搭方案：
        ---
        ${tuningPlan.description}
        ---
        
        用户提出了修改要求：
        ${tuningInput}
        
        当前的库中可选单品（包含了配饰、鞋子等）：
        ${candidates.map(i => `${i.name}(ID:${i.id}, 分类:${i.category})`).join('、')}

        请按照用户的要求重新调整方案（如替换、添加、删除包含单品等，特别是鞋子和配饰可以根据需求加入）。
        请严格按照最新的输出要求输出完整的全新方案文本：
        1. 【单品组合】部分：如果有库中适合的单品，请结合搭配库。如果库中没有合适的单品(特别是鞋履和配饰)，请用文字描述推荐单品名称(如：建议搭配一双白色帆布鞋)，**绝对不要为了硬搭而选择库中不合适的单品**。
           格式必须为：
           - 类别名（如：上衣/下装/鞋履/配饰）：单品名称 (如果选了库中单品，请加上 ID:xxx)
             - 品类/设计：详细描述设计感、图案、颜色等
             - 品质/搭配关系：面料品质或与其他单品的搭配关系，如何提升整体质感
             - 版型/舒适度/便利性：版型信息、穿着舒适度、对小女孩的活动便利性
        2. 文末必须包含一个提取出来的ID汇总，格式为：使用建议ID: [ID1, ID2, ...] (仅包含从可选库中挑选的ID，没有则为空)。
        如果需要参考上传的图片风格或元素，请将图片中的信息融入文字描述中。
      `;

      const contents: any[] = [prompt];
      if (tuningReferenceImage) {
        contents.push({
          inlineData: {
            data: tuningReferenceImage.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents
      });
      const text = response.text || '';

      const matchedIds: string[] = [];
      const idMatch = text.match(/(?:使用建议)?ID[^\n\[]*\[(.*?)\]/);
      const idString = idMatch ? idMatch[1] : text;
      
      candidates.forEach(c => {
        const tokens = idString.split(/[^a-zA-Z0-9_\-]+/);
        if (tokens.includes(c.id)) {
          matchedIds.push(c.id);
        }
      });

      const historyEntry = {
        id: Date.now().toString(),
        prompt: tuningInput,
        referenceImage: tuningReferenceImage,
        timestamp: Date.now()
      };

      const updatedPlan = {
        ...tuningPlan,
        matchedItemIds: matchedIds,
        description: cleanDescription(text),
        tuningRecords: [historyEntry, ...(tuningPlan.tuningRecords || [])]
      };

      setTuningPlan(updatedPlan);
      // Update global plan
      setStylingPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setCurrentGenerationPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setViewingPlan(prev => prev?.id === updatedPlan.id ? updatedPlan : prev);
      setTuningInput('');
      setTuningReferenceImage(null);

      // Regenerate the fitting image based on the new description
      handleGenerateFittingImage(updatedPlan);

    } catch (e) {
      console.error(e);
      alert('更新方案失败，请稍后再试或检查额度。');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const getGenerationPrompt = (plan: StylingPlan | null) => {
    let itemsDesc = '';
    if (plan) {
      const planItems = [
        getItemById(plan.mainItemId), 
        ...plan.matchedItemIds.map(id => getItemById(id))
      ].filter(Boolean) as ClothingItem[];
      itemsDesc = planItems.map(i => `${i.name}(${i.category})`).join(', ');
    }

    const baseDesc = plan ? cleanDescription(plan.description) : '休闲童装';
    // 使用纯正向提示词，避免AI过度关注“不要”后面的词导致起反效果（如手脚畸形）。
    // 将主要场景和人物描述翻译为英文结构以获得模型最佳表现，服装部分保留中文以保持原意。
    const prompt = `Masterpiece, best quality, ultra-detailed, 8-year-old Asian girl child model, small oval face, soft delicate features, black medium straight hair with natural side part, no bangs. She is standing naturally, full body front view, pure white background, centered, full body shot including shoes. Wearing exactly these clothing items: ${itemsDesc}. Style context: ${baseDesc}. High quality e-commerce commercial photography, clear outfit details, realistic fabric texture, uniform studio lighting. Perfect proportions, flawless anatomy, perfectly drawn face, perfectly drawn hands and feet.`;
    return encodeURIComponent(prompt);
  };

  const handleGenerateFittingImage = (overridePlan?: StylingPlan) => {
    setIsGenerating(true);
    const plan = overridePlan || currentGenerationPlans[selectedPlanIndex] || stylingPlans[0];
    const keywords = getGenerationPrompt(plan);
    
    // Generate 1 image
    setTimeout(() => {
      const generatedUrl = `https://image.pollinations.ai/prompt/${keywords}?width=768&height=1024&nologo=true&seed=${Date.now()}`;
      setFittingImage(generatedUrl);
      setIsGenerating(false);
      
      const updatedPlan = { ...plan, fittingImage: generatedUrl };
      if (updatedPlan.tuningRecords && updatedPlan.tuningRecords.length > 0) {
        if (!updatedPlan.tuningRecords[0].resultFittingImage) {
          updatedPlan.tuningRecords = [
            { ...updatedPlan.tuningRecords[0], resultFittingImage: generatedUrl },
            ...updatedPlan.tuningRecords.slice(1)
          ];
        }
      }
      
      if (updatedPlan.id !== tuningPlan?.id) {
        setAssets([]);
        setNotebookCover(null);
        setNotebookText('');
        setNotebookPrompt('');
        setTuningInput('');
        setTuningReferenceImage(null);
      }
      
      setTuningPlan(updatedPlan);
      setStylingPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setCurrentGenerationPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setViewingPlan(prev => prev?.id === updatedPlan.id ? updatedPlan : prev);
      
      setActiveTab('tuning');
    }, 1500);
  };

  const handleGenerateNotebookText = async () => {
    if (!tuningPlan) return;
    setIsGeneratingNotebookText(true);
    try {
      const items = [
        getItemById(tuningPlan.mainItemId), 
        ...tuningPlan.matchedItemIds.map(id => getItemById(id))
      ].filter(Boolean) as ClothingItem[];
      
      const itemsDesc = items.map(i => `${i.name}(${i.category})`).join('、');
      const prompt = `
        你是一位小红书资深童装穿搭博主。请根据以下的童装穿搭方案，撰写一篇高赞的穿搭笔记。
        
        穿搭服装：${itemsDesc}
        风格：${tuningPlan.vibe}
        搭配思路：${cleanDescription(tuningPlan.description)}
        
        要求：
        1. 标题吸引人，包含emoji（不超过20个字）。
        2. 正文语气活泼，适合宝妈分享的口吻。
        3. 强调面料舒适、搭配实用、拍照上镜。
        4. 包含热门标签（如 #童装穿搭 #女童穿搭 #ootd）。
        5. 不要编造品牌信息（如果未提供品牌）。
      `;

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      
      setNotebookText(response.text || '');
    } catch (error) {
      console.error(error);
      alert('生成文本失败，请稍后再试或检查额度。');
    } finally {
      setIsGeneratingNotebookText(false);
    }
  };

  const handleGenerateNotebookAssets = (plan: StylingPlan, extraPrompt: string = '') => {
    setIsGeneratingMoreAssets(true);
    const baseKeywords = getGenerationPrompt(plan);
    const keywords = extraPrompt ? encodeURIComponent(decodeURIComponent(baseKeywords) + ' ' + extraPrompt) : baseKeywords;
    
    // If it's the first time we enter the notebook tab, we generate 5 images.
    // If we are adding more, we generate 2 more.
    const isInitial = assets.length === 0;
    const count = isInitial ? 5 : 2;
    
    setTimeout(() => {
      const newImages = Array.from({ length: count }).map((_, i) => 
        `https://image.pollinations.ai/prompt/${keywords}?width=768&height=1024&nologo=true&seed=${Date.now() + i}`
      );
      setAssets(prev => isInitial ? newImages : [...prev, ...newImages]);
      setIsGeneratingMoreAssets(false);
      
      // If we called this from the tuning tab, switch to assets tab
      if (activeTab === 'tuning') {
        setActiveTab('assets');
      }
    }, 2000);
  };

  // View: Login
  if (!user.type) {
    return (
      <div className="iphone-container flex flex-col items-center justify-center p-8 bg-gradient-to-b from-brand-primary/20 to-white">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-12"
        >
          <div className="w-24 h-24 bg-brand-primary rounded-3xl flex items-center justify-center shadow-lg mx-auto mb-6 transform rotate-3">
            <Shirt size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">KidStyle AI</h1>
          <p className="text-gray-500 mt-2">智能童装搭配生成系统</p>
        </motion.div>

        <div className="w-full space-y-4">
          <button 
            id="login-parent"
            onClick={() => setUser({ type: UserType.PARENT, name: '甜心家长' })}
            className="w-full py-4 bg-white border-2 border-brand-primary text-brand-primary rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
          >
            <User size={20} />
            我是家长
          </button>
          <button 
            id="login-store"
            onClick={() => setUser({ type: UserType.STORE_OWNER, name: 'Mini Pease 旗舰店' })}
            className="w-full py-4 bg-brand-primary text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-md"
          >
            <Home size={20} />
            我是店老板/官方运营
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-8">授权登录即代表同意用户服务协议</p>
      </div>
    );
  }

  return (
    <div className="iphone-container flex flex-col relative">
      <AnimatePresence>
        {backgroundStylingNames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-4 left-1/2 z-50 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-brand-primary/20 flex items-center gap-2 max-w-[90%] w-max"
          >
            <Loader2 size={16} className="animate-spin text-brand-primary shrink-0" />
            <span className="text-xs font-bold text-gray-800 truncate">
              正在后台为 {backgroundStylingNames.length} 个单品生成搭配...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5"
            >
              <header className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 tracking-tight">你好, {user.name}</h1>
                  <p className="text-sm text-gray-400 mt-1">今天想为孩子选什么风格？</p>
                </div>
                <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                  <Sparkles size={24} />
                </div>
              </header>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <button 
                  onClick={() => setActiveTab('plans')}
                  className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left active:scale-95 transition-transform"
                >
                  <p className="text-[10px] text-gray-400 font-bold uppercase">搭配方案</p>
                  <p className="text-xl font-mono font-bold mt-1 text-gray-800">{stylingPlans.length}</p>
                </button>
                <button 
                  onClick={() => setActiveTab('assets')}
                  className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left active:scale-95 transition-transform"
                >
                  <p className="text-[10px] text-gray-400 font-bold uppercase">穿搭笔记</p>
                  <p className="text-xl font-mono font-bold mt-1 text-gray-800">{assets.length > 0 ? 5 : 0}</p>
                </button>
                <button 
                  onClick={() => setActiveTab('wardrobe')}
                  className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left active:scale-95 transition-transform"
                >
                  <p className="text-[10px] text-brand-primary font-bold uppercase">今日上新</p>
                  <p className="text-xl font-mono font-bold mt-1 text-brand-primary">
                    {wardrobeItems.filter(i => {
                      if (!i.createdAt) return false;
                      const d = new Date(i.createdAt);
                      const t = new Date();
                      return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
                    }).length}
                  </p>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <button 
                  onClick={() => enterCreationHub()}
                  className="w-full p-6 bg-brand-primary rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-brand-primary/20"
                >
                  <div className="text-left">
                    <p className="text-lg font-bold">进入搭配助手</p>
                    <p className="text-xs opacity-80 mt-1">AI 极速生成3套专业方案</p>
                  </div>
                  <div className="bg-white/20 p-2 rounded-xl">
                    <ChevronRight size={20} />
                  </div>
                </button>

                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ImageIcon size={18} className="text-brand-secondary" />
                    系统动态
                  </h3>
                  <div className="space-y-4 text-sm text-gray-500">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5" />
                      <p>【更新】2024冬季复古学院风系列已加入素材库</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5" />
                      <p>【提示】请确认您的身份以获得最佳推荐体验</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'styling' && (
            <motion.div 
              key="styling"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-5"
            >
              <header className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">搭配中心</h2>
                  <p className="text-sm text-gray-500">
                    {user.type === UserType.PARENT ? '为宝宝创造时尚穿搭' : '店铺素材高效生成'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden text-xs flex items-center justify-center font-bold text-brand-primary">
                  {user.name.charAt(0)}
                </div>
              </header>

              {/* Character Preview */}
              <div className="relative mb-8">
                {currentGenerationPlans.length > 0 ? (
                  <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-gray-100 shadow-sm snap-x snap-mandatory flex overflow-x-auto scrollbar-hide"
                       id="model-carousel"
                       onScroll={(e) => {
                         const target = e.target as HTMLDivElement;
                         const index = Math.round(target.scrollLeft / target.clientWidth);
                         if (index !== selectedPlanIndex && index >= 0 && index < currentGenerationPlans.length) {
                           setSelectedPlanIndex(index);
                         }
                       }}
                  >
                    {currentGenerationPlans.map((plan, idx) => (
                      <div key={idx} className="w-full h-full shrink-0 snap-start relative bg-gray-100">
                        <img 
                          src={plan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} 
                          alt={`Scheme ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const fallback = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
                            if (target.src !== fallback) target.src = fallback;
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/50 to-transparent flex justify-between items-end">
                          <div className="text-white text-sm font-medium">方案 {idx + 1} 定妆图</div>
                          <div className="flex gap-1">
                            {currentGenerationPlans.map((_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-[3/4] bg-gray-100 rounded-3xl relative flex items-center justify-center overflow-hidden border border-gray-100">
                    <img 
                      src={customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} 
                      alt="Model"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const fallback = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
                        if (target.src !== fallback) target.src = fallback;
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                      <div className="text-white text-sm font-medium">8岁孩子 • 系统内置模特</div>
                    </div>
                  </div>
                )}
              </div>

              {currentGenerationPlans.length === 0 ? (
                hasGeneratedCurrentPlan ? (
                  <section className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
                        <Trash2 size={32} />
                      </div>
                      <h3 className="text-gray-500 font-medium mb-2">当前搭配方案已全部删除</h3>
                      <p className="text-xs text-gray-400 mb-6">您可以保留其他感兴趣的单品，重新生成新的灵感搭配。</p>
                      <button 
                        onClick={() => setHasGeneratedCurrentPlan(false)}
                        className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
                      >
                        <Sparkles size={18} />
                        重新选择单品生成
                      </button>
                    </div>
                  </section>
                ) : (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-700">选择一件童装单品</h3>
                      <span className="text-xs text-gray-400">我们将为您一次性生成3套不同风格的方案</span>
                    </div>
                    {wardrobeItems.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50 rounded-[2rem] border border-gray-100 mb-8">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-gray-300 mb-3 shadow-sm border border-gray-100">
                          <Shirt size={24} />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{user.type === UserType.STORE_OWNER ? '店铺' : '衣橱'}为空，无法生成搭配</p>
                        <button 
                          onClick={() => setActiveTab('wardrobe')}
                          className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold"
                        >
                          前往添加单品
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                        {(() => {
                          const sortedItems = [...wardrobeItems].reverse();
                          const todayItems = sortedItems.filter(i => {
                            if (!i.createdAt) return false;
                            const d = new Date(i.createdAt);
                            const t = new Date();
                            return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
                          });
                          const displayItems = selectedItem 
                            ? [selectedItem, ...todayItems.filter(i => i.id !== selectedItem.id)]
                            : todayItems;
                          
                          if (displayItems.length === 0 && !selectedItem) {
                            return (
                              <div className="col-span-2 lg:col-span-3 py-10 flex flex-col items-center justify-center text-center bg-gray-50 rounded-[2rem] border border-gray-100 mb-8">
                                <p className="text-gray-500 text-sm font-medium">今日暂无上新单品</p>
                                <button 
                                  onClick={() => setActiveTab('wardrobe')}
                                  className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold"
                                >
                                  前往添加单品
                                </button>
                              </div>
                            );
                          }

                          return displayItems.map(item => (
                            <div key={item.id} className="relative group">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                id={`item-${item.id}`}
                                onClick={() => setSelectedItem(item)}
                                className={`w-full p-2 rounded-2xl border-2 transition-all ${selectedItem?.id === item.id ? 'border-brand-primary bg-brand-primary/5 shadow-inner' : 'border-gray-50 bg-white hover:border-gray-200'}`}
                              >
                                <div className="aspect-square rounded-xl overflow-hidden mb-2">
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name} 
                                    referrerPolicy="no-referrer" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
                                    }}
                                  />
                                </div>
                                <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                                <p className="text-[10px] text-gray-400">{item.brand}</p>
                              </motion.button>
                              <button 
                                onClick={() => handleItemClick(item)}
                                className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Maximize2 size={12} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    <button 
                      id="start-styling"
                      disabled={!isReadyToGenerate || (selectedItem ? backgroundStylingTasks.has(selectedItem.id) : false)}
                      onClick={handleGenerateStyling}
                      className="w-full mt-8 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {selectedItem && backgroundStylingTasks.has(selectedItem.id) ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Sparkles size={20} />
                      )}
                      
                      {selectedItem && backgroundStylingTasks.has(selectedItem.id) 
                        ? '正在生成搭配方案...' 
                        : (!isReadyToGenerate ? '尚未完成特征解析，暂不可生成' : '由单品一键生成3套方案')}
                    </button>
                  </section>
                )
              ) : (
                <section className="space-y-6">
                  {/* Plan Selection Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {currentGenerationPlans.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedPlanIndex(idx);
                          const el = document.getElementById('model-carousel');
                          if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
                        }}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedPlanIndex === idx ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}
                      >
                        方案 {idx + 1}
                      </button>
                    ))}
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative pt-8">
                    <button 
                      onClick={() => {
                        const planToDelete = currentGenerationPlans[selectedPlanIndex];
                        if (planToDelete) {
                          setStylingPlans(prev => prev.filter(p => p.id !== planToDelete.id));
                          setCurrentGenerationPlans(prev => prev.filter(p => p.id !== planToDelete.id));
                          setSelectedPlanIndex(prev => Math.max(0, Math.min(prev, currentGenerationPlans.length - 2)));
                        }
                      }}
                      className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full text-gray-400 z-10 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="inline-block px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] uppercase font-bold tracking-widest mb-3">
                      场景风格方案 {selectedPlanIndex + 1}
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="text-sm mt-4 flex-1">
                        <PlanDescription description={currentGenerationPlans[selectedPlanIndex].description} hideItems={true} />
                      </div>
                    </div>
                    
                    <PlanCombinations 
                      plan={currentGenerationPlans[selectedPlanIndex]} 
                      getItemById={getItemById} 
                      handleItemClick={handleItemClick}
                      setActiveTab={setActiveTab}
                    />

                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        const newPlan = currentGenerationPlans[selectedPlanIndex] || stylingPlans[0];
                        if (newPlan?.id !== tuningPlan?.id) {
                          setAssets([]);
                          setNotebookCover(null);
                          setNotebookText('');
                          setNotebookPrompt('');
                          setTuningInput('');
                          setTuningReferenceImage(null);
                        }
                        setTuningPlan(newPlan);
                        setActiveTab('tuning');
                      }}
                      className="flex-[1] py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      <Settings2 size={20} />
                      穿搭调优
                    </button>
                    <button 
                      id="generate-assets"
                      disabled={isGenerating}
                      onClick={() => handleGenerateFittingImage()}
                      className="flex-[2] py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                      {isGenerating ? <RefreshCcw className="animate-spin" /> : <ImageIcon size={20} />}
                      {isGenerating ? '生成中...' : '生成模特穿搭定妆图'}
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {activeTab === 'wardrobe' && (
            <motion.div 
              key="wardrobe"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">{user.type === UserType.STORE_OWNER ? '我的店铺' : '我的衣橱'}</h2>
                <div className="text-sm px-3 py-1 bg-gray-100 rounded-full text-gray-500">
                  {user.type === UserType.STORE_OWNER ? '官方同步' : '当前存储: ' + wardrobeItems.length}
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <label className={`flex items-center gap-2 px-4 py-2 ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary cursor-pointer hover:bg-brand-primary/90'} text-white text-sm font-bold rounded-xl shadow-sm transition-colors`}>
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                  {isUploading ? '处理中...' : '上传单品'}
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkUpload} disabled={isUploading} />
                </label>

                {wardrobeItems.length > 0 && (
                  <button 
                    onClick={() => {
                      if (isEditMode && selectedItemIds.size > 0) {
                        handleBulkDelete();
                      } else {
                        setIsEditMode(!isEditMode);
                        setSelectedItemIds(new Set());
                      }
                    }}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                      isEditMode && selectedItemIds.size > 0 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : isEditMode 
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isEditMode 
                      ? selectedItemIds.size > 0 ? `删除 (${selectedItemIds.size})` : '取消选择'
                      : '批量管理'}
                  </button>
                )}
              </div>

              {wardrobeItems.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-3xl mt-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                    <Shirt size={40} />
                  </div>
                  <h3 className="text-gray-500 font-medium text-lg">{user.type === UserType.STORE_OWNER ? '店铺' : '衣橱'}空空如也</h3>
                  <p className="text-gray-400 text-sm mt-2">快去添加一些精彩的单品吧</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {[...wardrobeItems].reverse().map(item => (
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      key={item.id} 
                      onClick={() => {
                        if (isEditMode) {
                          handleToggleSelect(item.id);
                        } else {
                          handleItemClick(item);
                        }
                      }}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm border group text-left relative transition-all ${
                        isEditMode && selectedItemIds.has(item.id) 
                          ? 'border-brand-primary ring-2 ring-brand-primary/20 scale-95' 
                          : 'border-gray-50 hover:border-gray-200 hover:shadow-md'
                      }`}
                    >
                      {isEditMode && (
                        <div className="absolute top-2 left-2 z-10 text-brand-primary">
                          {selectedItemIds.has(item.id) ? (
                            <div className="bg-white rounded-full"><CheckCircle2 size={24} className="fill-brand-primary text-white" /></div>
                          ) : (
                            <div className="bg-white/80 rounded-full"><Circle size={24} className="text-gray-300" /></div>
                          )}
                        </div>
                      )}
                      <div className="aspect-square relative overflow-hidden">
                        <img src={item.imageUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        
                        {identifyingItemIds.has(item.id) && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="bg-white p-2 text-brand-primary rounded-full shadow-md animate-pulse">
                              <Loader2 size={24} className="animate-spin" />
                            </div>
                          </div>
                        )}

                        {!isEditMode && !identifyingItemIds.has(item.id) && (
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/90 p-2 rounded-full shadow-lg">
                              <Maximize2 size={18} className="text-brand-primary" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter">{item.category}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-6 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary p-1 mb-4">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl font-black text-brand-primary">
                    {user.name.charAt(0)}
                  </div>
                </div>
                <h2 className="text-xl font-bold">{user.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{user.type === UserType.PARENT ? '时尚家长专家' : '认证店铺官服'}</p>
              </div>

              <div className="space-y-3">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 mb-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">模特形象设置</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <img src={customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} className="w-full h-full object-cover" alt="Model preview" />
                    </div>
                    <div className="flex-1">
                      <label className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer inline-block">
                        上传自定义模特照片
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                try {
                                    const base64 = await fileToBase64(file);
                                    setCustomModelImage(base64);
                                } catch (e) {
                                    console.error('Failed to encode image', e);
                                }
                            }
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-gray-400 mt-1">支持本地上传，您可以上传您偏好的模特图片以供搭配生成使用。</p>
                    </div>
                  </div>
                </div>

                <div 
                  className="cursor-pointer" 
                  onClick={() => setActiveTab('plans')}
                >
                  <NavItem icon={<Shirt size={18}/>} label="搭配方案" value={stylingPlans.length.toString()} />
                </div>
                <div 
                  className="cursor-pointer"
                  onClick={() => setActiveTab('assets')}
                >
                  <NavItem icon={<ImageIcon size={18}/>} label="穿搭笔记" value={assets.length > 0 ? "5" : "0"} />
                </div>
                <div className="h-px bg-gray-100 my-4" />
                <button 
                  onClick={() => setUser({ type: null, name: '' })}
                  className="w-full p-4 flex items-center justify-between text-red-500 bg-red-50 rounded-2xl"
                >
                  <div className="flex items-center gap-3 font-semibold">
                    <LogOut size={18} />
                    <span>退出登录</span>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
          {activeTab === 'plans' && (() => {
            const displayedPlans = filterItemId 
              ? stylingPlans.filter(p => p.mainItemId === filterItemId || p.matchedItemIds.includes(filterItemId))
              : stylingPlans;
              
            return (
              <motion.div 
                key="plans"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <button 
                    onClick={() => {
                      if (filterItemId) {
                        setFilterItemId(null);
                        setActiveTab('wardrobe');
                      } else {
                        setActiveTab('profile');
                      }
                    }}
                    className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500"
                  >
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                  <h2 className="text-xl font-bold text-gray-800">
                    {filterItemId ? '相关搭配方案' : `搭配方案 (${displayedPlans.length})`}
                  </h2>
                </div>
                
                {displayedPlans.length === 0 ? (
                  <div className="py-12 bg-white rounded-[2rem] border border-gray-100 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 shadow-sm">
                      <Shirt size={32} />
                    </div>
                    <p className="text-gray-400 text-sm mb-6">暂无搭配方案，快去生成吧</p>
                    <button 
                      onClick={() => {
                        let targetItem;
                        if (filterItemId) {
                          targetItem = getItemById(filterItemId);
                        }
                        enterCreationHub(targetItem);
                      }}
                      className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      <Sparkles size={18} />
                      去生成搭配
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedPlans.map((plan, i) => (
                      <PlanSummaryCard 
                        key={plan.id}
                        plan={plan}
                        title={`方案 ${i + 1}: ${plan.vibe}`}
                        getItemById={getItemById}
                        customModelImage={customModelImage}
                        onClick={() => {
                          setViewingPlan(plan);
                          setActiveTab('planDetail');
                        }}
                      />
                    ))}
                    
                    <button 
                      onClick={() => {
                        let targetItem;
                        if (filterItemId) {
                          targetItem = getItemById(filterItemId);
                        }
                        enterCreationHub(targetItem);
                      }}
                      className="w-full mt-6 py-4 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      生成更多搭配
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {activeTab === 'planDetail' && viewingPlan && (
            <motion.div 
              key="planDetail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 flex flex-col min-h-full pb-24"
            >
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => setActiveTab('plans')}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-800">搭配详情</h2>
              </div>
              
              <div className="relative mb-8">
                <div 
                  className="mb-6 rounded-2xl overflow-hidden aspect-[3/4] border border-gray-100 shadow-sm relative bg-gray-100 flex items-center justify-center cursor-pointer"
                  onClick={() => setEnlargedImage(viewingPlan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE)}
                >
                   <img 
                     src={viewingPlan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} 
                     className="w-full h-full object-cover relative z-0" 
                     alt="Model"
                     referrerPolicy="no-referrer"
                     onError={(e) => {
                       const target = e.target as HTMLImageElement;
                       const fallback = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
                       if (target.src !== fallback) target.src = fallback;
                     }}
                   />
                   <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10">
                     <div className="text-white text-sm font-medium">8岁孩子 • {viewingPlan.fittingImage ? '定妆图' : '系统内置模特'}</div>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 text-sm text-gray-700 leading-relaxed">
                <PlanDescription description={viewingPlan.description} hideItems={true} />
              </div>

              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Shirt size={18} className="text-brand-primary" />
                包含单品
              </h3>
              
              <div className="mb-8">
                <PlanCombinations 
                  plan={viewingPlan} 
                  getItemById={getItemById} 
                  handleItemClick={handleItemClick}
                  setActiveTab={setActiveTab}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <button 
                  onClick={() => {
                    setTuningPlan(viewingPlan);
                    setActiveTab('tuning');
                  }}
                  className="w-full py-3 bg-brand-primary/10 text-brand-primary font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <Palette size={18} />
                  修改调优
                </button>
                <button 
                  onClick={() => {
                    // For simply going to generate assets
                    setTuningPlan(viewingPlan);
                    setActiveTab('assets');
                  }}
                  className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md"
                >
                  <Gem size={18} />
                  生成模特定妆图
                </button>
              </div>

            </motion.div>
          )}

          {activeTab === 'tuning' && tuningPlan && (
            <motion.div 
              key="tuning"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 flex flex-col min-h-full pb-24"
            >
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => {
                    setActiveTab(previousTab === 'home' ? 'styling' : previousTab);
                  }}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-800">穿搭调优</h2>
              </div>

              <div 
                className="mb-6 rounded-2xl overflow-hidden aspect-[3/4] border border-gray-100 shadow-sm relative bg-gray-100 flex items-center justify-center cursor-pointer"
                onClick={() => setEnlargedImage(tuningPlan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE)}
              >
                 <img 
                   src={tuningPlan.fittingImage || customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE} 
                   className="w-full h-full object-cover relative z-0" 
                   alt="Model"
                   referrerPolicy="no-referrer"
                   onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     const fallback = customModelImage || APP_CONFIG.DEFAULT_MODEL_IMAGE;
                     if (target.src !== fallback) target.src = fallback;
                   }}
                 />
                 <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent flex flex-col gap-3 z-10 transition-opacity">
                   <div className="text-white text-sm font-medium mb-1">8岁孩子 • {tuningPlan.fittingImage ? '定妆图' : '系统内置模特'}</div>
                   <div className="flex gap-2">
                     <button 
                       disabled={isGenerating}
                       onClick={(e) => {
                         e.stopPropagation();
                         handleGenerateFittingImage(tuningPlan);
                         setStylingPlans(prev => prev.map(p => p.id === tuningPlan.id ? tuningPlan : p));
                         setCurrentGenerationPlans(prev => prev.map(p => p.id === tuningPlan.id ? tuningPlan : p));
                       }}
                       className="flex-[1] py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap text-xs transition-colors"
                     >
                       {isGenerating ? <RefreshCcw className="animate-spin w-4 h-4" /> : <ImageIcon size={16} />}
                       {isGenerating ? '生成中...' : (tuningPlan.fittingImage ? '重新生成图像' : '立即生成定妆图')}
                     </button>
                     {tuningPlan.fittingImage && (
                       <button 
                         disabled={isGeneratingAssets}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleGenerateNotebookAssets(tuningPlan);
                           setStylingPlans(prev => prev.map(p => p.id === tuningPlan.id ? tuningPlan : p));
                           setCurrentGenerationPlans(prev => prev.map(p => p.id === tuningPlan.id ? tuningPlan : p));
                         }}
                         className="flex-[1] py-2 bg-brand-primary/90 hover:bg-brand-primary backdrop-blur-md border border-brand-primary text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap text-xs transition-colors"
                       >
                         {isGeneratingAssets ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Layers size={16} />}
                         {isGeneratingAssets ? '生成中...' : '生成笔记组图'}
                       </button>
                     )}
                   </div>
                 </div>
                 {isGenerating && (
                   <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-brand-primary z-20 transition-opacity">
                     <Loader2 size={32} className="animate-spin mb-2" />
                     <span className="text-sm font-bold bg-white/80 px-3 py-1 rounded-full shadow-sm">AI 绘制中...</span>
                   </div>
                 )}
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 w-full">
                <div className="inline-block px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] uppercase font-bold tracking-widest mb-4">
                  当前方案搭配
                </div>

                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="relative group">
                    {(() => {
                      const mainItem = getItemById(tuningPlan.mainItemId);
                      if (!mainItem) return null;
                      return (
                        <div className="w-20 h-24 bg-white rounded-xl overflow-hidden border-2 border-brand-primary shadow-sm flex flex-col relative">
                          <img src={mainItem.imageUrl} referrerPolicy="no-referrer" className="w-full h-16 object-cover" />
                          <div className="p-1 px-2 text-[8px] text-brand-primary bg-brand-primary/5 font-bold text-center truncate">{mainItem.name}</div>
                        </div>
                      )
                    })()}
                  </div>
                  {tuningPlan.matchedItemIds.map(id => {
                    const item = wardrobeItems.find(i => i.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} className="w-20 h-24 bg-white rounded-xl overflow-hidden border border-gray-200 flex flex-col relative">
                        <img src={item.imageUrl} referrerPolicy="no-referrer" className="w-full h-16 object-cover" />
                        <div className="p-1 text-[8px] text-gray-500 text-center truncate">{item.name}</div>
                        <button 
                          onClick={() => {
                            setTuningPlan(prev => prev ? { ...prev, matchedItemIds: prev.matchedItemIds.filter(itemId => itemId !== id) } : prev);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md transform scale-90"
                        >
                          <Plus size={12} className="rotate-45" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {tuningPlan.tuningRecords && tuningPlan.tuningRecords.length > 0 && (
                  <>
                    <div className="h-px bg-gray-100 mb-6" />
                    <h3 className="font-bold text-gray-700 mb-4 text-sm">调优记录</h3>
                    <div className="space-y-3 mb-8 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                      {tuningPlan.tuningRecords.map((record) => (
                        <div key={record.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setTuningInput(record.prompt)}>
                          <div className="flex gap-3">
                            {record.resultFittingImage && (
                              <div className="relative group shrink-0" onClick={(e) => { e.stopPropagation(); setEnlargedImage(record.resultFittingImage!); }}>
                                <div className="w-12 h-16 rounded overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:border-brand-primary/50 transition-colors">
                                  <img src={record.resultFittingImage} className="w-full h-full object-cover" />
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedPlan = { ...tuningPlan, fittingImage: record.resultFittingImage! };
                                    setTuningPlan(updatedPlan);
                                    setStylingPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
                                    setCurrentGenerationPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
                                    setViewingPlan(prev => prev?.id === updatedPlan.id ? updatedPlan : prev);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center shadow-md transform scale-90 opacity-0 group-hover:opacity-100 transition-all z-10"
                                  title="设为主图"
                                >
                                  <Check size={12} />
                                </button>
                                {tuningPlan.fittingImage === record.resultFittingImage && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border border-white text-white rounded-full flex items-center justify-center shadow-md z-10">
                                     <Check size={10} />
                                  </div>
                                )}
                              </div>
                            )}
                            {record.referenceImage && !record.resultFittingImage && (
                              <div className="w-12 h-12 shrink-0 rounded overflow-hidden border border-gray-200">
                                <img src={record.referenceImage} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-gray-700">{record.prompt}</p>
                              <p className="text-gray-400 text-xs mt-1">{new Date(record.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="h-px bg-gray-100 mb-6" />
                
                <h3 className="font-bold text-gray-700 mb-4 text-sm">点击添加库内单品/配饰/鞋子</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-8 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                  {wardrobeItems.filter(i => i.id !== tuningPlan.mainItemId && !tuningPlan.matchedItemIds.includes(i.id)).map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        setTuningPlan(prev => prev ? { ...prev, matchedItemIds: [...prev.matchedItemIds, item.id] } : prev);
                      }}
                      className="aspect-[3/4] bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative opacity-70 hover:opacity-100"
                    >
                      <img src={item.imageUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 py-1 bg-black/40 text-white text-[8px] text-center truncate px-1">
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="h-px bg-gray-100 mb-6" />

                <h3 className="font-bold text-gray-700 mb-4 text-sm">提供文本/图片调优需求</h3>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <textarea 
                      value={tuningInput}
                      onChange={(e) => setTuningInput(e.target.value)}
                      placeholder="例如：配饰换成红色小礼帽，或者加入图片中的鞋子风格..."
                      className="w-full border border-gray-200 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                      rows={3}
                    />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                       <label className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors shadow-sm cursor-pointer">
                         <ImageIcon size={16} />
                         <input 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                               const base64 = await fileToBase64(file);
                               setTuningReferenceImage(base64);
                             }
                           }}
                         />
                       </label>
                       {tuningReferenceImage && (
                          <div className="relative w-8 h-8 rounded overflow-hidden border border-gray-200">
                             <img src={tuningReferenceImage} className="w-full h-full object-cover" />
                             <button 
                               onClick={() => setTuningReferenceImage(null)}
                               className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                             >
                                <Trash2 size={12} className="text-white" />
                             </button>
                          </div>
                       )}
                    </div>
                    <button 
                      onClick={handleUpdatePlanText}
                      disabled={isUpdatingPlan || !tuningInput.trim()}
                      className="absolute bottom-3 right-3 bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isUpdatingPlan ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isUpdatingPlan ? '智能调整中...' : '提交更新'}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div 
              key="assets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 flex flex-col min-h-full pb-24"
            >
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => setActiveTab('tuning')}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-800">搭配笔记编辑</h2>
              </div>
              
              {assets.length === 0 ? (
                <div className="py-12 bg-white rounded-[2rem] border border-gray-100 flex flex-col items-center justify-center text-center px-6 mb-6">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 shadow-sm">
                    <ImageIcon size={32} />
                  </div>
                  <p className="text-gray-400 text-sm">暂无穿搭笔记</p>
                </div>
              ) : (
                <>
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-700 text-sm">拍摄需求调优</h3>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={notebookPrompt}
                        onChange={e => setNotebookPrompt(e.target.value)}
                        placeholder="需要调整表情、动作、场景吗？"
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-primary"
                      />
                      <button 
                        onClick={() => handleGenerateNotebookAssets(tuningPlan!, notebookPrompt)}
                        disabled={isGeneratingMoreAssets}
                        className="bg-brand-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap flex items-center gap-1"
                      >
                        {isGeneratingMoreAssets ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                        生成改图
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {assets.map((url, i) => (
                      <div key={i} className={`relative aspect-[3/4] bg-white p-1 rounded-2xl shadow-sm border ${notebookCover === url ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-100'}`}>
                        <img src={url} referrerPolicy="no-referrer" className="w-full h-full object-cover rounded-xl" />
                        <button 
                          onClick={() => setNotebookCover(url)}
                          className={`absolute top-3 left-3 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm transition-colors ${notebookCover === url ? 'bg-brand-primary text-white' : 'bg-white/80 text-gray-600 hover:bg-white'}`}
                        >
                          {notebookCover === url ? '已设封面' : '设为封面'}
                        </button>
                        <button 
                          onClick={() => setAssets(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute bottom-3 right-3 w-6 h-6 bg-red-500/80 text-white rounded-full flex items-center justify-center hover:bg-red-500 shadow-sm"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {!notebookCover ? (
                    <div className="text-center text-sm text-gray-500 bg-gray-50 py-4 rounded-2xl border border-gray-100 border-dashed">
                      请在上方选择一张图片设为封面，以生成小红书笔记
                    </div>
                  ) : (
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                      <h3 className="font-bold text-gray-700 text-sm mb-4">生成小红书笔记</h3>
                      {notebookText ? (
                        <div className="relative">
                          <textarea 
                            value={notebookText}
                            onChange={e => setNotebookText(e.target.value)}
                            className="w-full h-64 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-700 focus:outline-none focus:border-brand-primary"
                          />
                          <button 
                            onClick={handleGenerateNotebookText}
                            disabled={isGeneratingNotebookText}
                            className="absolute top-4 right-4 text-gray-400 hover:text-brand-primary transition-colors"
                            title="重新生成"
                          >
                            <RefreshCcw size={16} className={isGeneratingNotebookText ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleGenerateNotebookText}
                          disabled={isGeneratingNotebookText}
                          className="w-full py-4 bg-gray-50 border border-gray-100 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2"
                        >
                          {isGeneratingNotebookText ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                          {isGeneratingNotebookText ? 'AI写手撰写中...' : 'AI 一键生成穿搭文案'}
                        </button>
                      )}

                      {notebookText && (
                        <button className="w-full mt-4 py-4 bg-brand-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">
                          <Check size={20} />
                          保存配套图文到相册
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-3 safe-area-bottom flex justify-between items-center shadow-lg z-50">
        <TabButton 
          active={activeTab === 'home'} 
          onClick={() => { setActiveTab('home'); setFilterItemId(null); }} 
          icon={<Home size={22} />} 
          label="首页" 
        />
        <TabButton 
          active={activeTab === 'styling' || activeTab === 'tuning'} 
          onClick={() => enterCreationHub()} 
          icon={<Plus className={activeTab === 'styling' || activeTab === 'tuning' ? 'text-white' : 'text-gray-400'} />} 
          label="搭配"
          isMain
        />
        <TabButton 
          active={activeTab === 'wardrobe' || activeTab === 'plans'} 
          onClick={() => { setActiveTab('wardrobe'); setFilterItemId(null); }} 
          icon={<Shirt size={22} />} 
          label={user.type === UserType.STORE_OWNER ? "我的店铺" : "衣橱"} 
        />
        <TabButton 
          active={activeTab === 'profile'} 
          onClick={() => { setActiveTab('profile'); setFilterItemId(null); }} 
          icon={<User size={22} />} 
          label="我的" 
        />
      </nav>

      <AnimatePresence>
        {enlargedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <button className="absolute top-6 right-6 text-white bg-black/50 p-2 rounded-full backdrop-blur-sm self-start" onClick={() => setEnlargedImage(null)}>
               <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={enlargedImage} 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-xl">
          {icon}
        </div>
        <span className="font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-sm font-mono font-bold text-gray-600">{value}</span>
        <ChevronRight size={16} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, isMain }: { active: boolean, onClick: () => void, icon: any, label: string, isMain?: boolean }) {
  if (isMain) {
    return (
      <button onClick={onClick} className="flex flex-col items-center -mt-10">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${active ? 'bg-brand-primary scale-110' : 'bg-gray-400 hover:bg-gray-500'}`}>
          {icon}
        </div>
      </button>
    );
  }
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

