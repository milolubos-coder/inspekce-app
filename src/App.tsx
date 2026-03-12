status: 'Rozpracované', 
      podlazi: [
        { id: 'f3', nazev: 'Přízemí', imgUrl: 'svg' }
      ]
    },
  ]);

  const [activeProject, setActiveProject] = useState<Projekt | null>(null);
  const [activePodlaziId, setActivePodlaziId] = useState<string | null>(null);
  
  // Body (Dáta)
  const [body, setBody] = useState<Bod[]>([
    { id: 'b1', projectId: 'p1', podlaziId: 'f1', cislo: 1, nazev: 'Prasklina v stene', poznamka: 'Nutná oprava omietky', x: 20, y: 30, foto: null },
    { id: 'b2', projectId: 'p1', podlaziId: 'f1', cislo: 2, nazev: 'Chýbajúca kľučka', poznamka: 'Objednať nový diel', x: 60, y: 70, foto: null },
    { id: 'b3', projectId: 'p1', podlaziId: 'f2', cislo: 3, nazev: 'Rozbité okno', poznamka: 'Kancelář 204', x: 40, y: 40, foto: null },
  ]);

  // Stav pre nový bod
  const [newPointCoords, setNewPointCoords] = useState<{x: number, y: number} | null>(null);
  const [formData, setFormData] = useState<{nazev: string, poznamka: string, foto: string | null}>({ nazev: '', poznamka: '', foto: null });
  
  // Stavy pro simulaci PDF procesu
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);

  // --- STAVY PRE ZOOM A PAN ---
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const clickStartRef = useRef<{x: number, y: number} | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- STAV PRE REŽIM PRIDÁVANIA ---
  const [isAddMode, setIsAddMode] = useState(false);

  // --- STAVY PRE PRESUN BODU ---
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  // --- Funkcie ---

  const handleSelectProject = (project: Projekt) => {
    setActiveProject(project);
    if (project.podlazi.length > 0) {
        setActivePodlaziId(project.podlazi[0].id);
    }
    setCurrentView('dashboard');
    setPdfNotification(null);
    setTransform({ scale: 1, x: 0, y: 0 });
    setIsAddMode(false);
  };

  const handleZoom = (delta: number) => {
    setTransform(prev => ({
        ...prev,
        scale: Math.max(0.5, Math.min(4, prev.scale + delta))
    }));
  };

  const handleResetView = () => {
      setTransform({ scale: 1, x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent, pointId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();

    clickStartRef.current = { x: e.clientX, y: e.clientY };

    if (pointId) {
        setDraggingPointId(pointId);
    } else {
        setIsDraggingMap(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPointId) {
        if (!mapContainerRef.current) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        
        const xPixels = (e.clientX - rect.left - transform.x) / transform.scale;
        const yPixels = (e.clientY - rect.top - transform.y) / transform.scale;

        const xPercent = (xPixels / rect.width) * 100;
        const yPercent = (yPixels / rect.height) * 100;

        setBody(prevBody => prevBody.map(b => 
            b.id === draggingPointId 
                ? { ...b, x: Math.max(0, Math.mi100, xPercent)), y: Math.max(0, Math.min(100, yPercent)) } 
                : b
        ));

    } else if (isDraggingMap) {
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingMap(false);
    setDraggingPointId(null);
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (clickStartRef.current) {
        const dist = Math.sqrt(
            Math.pow(e.clientX - clickStartRef.current.x, 2) + 
            Math.pow(e.clientY - clickStartRef.current.y, 2)
        );
        if (dist > 5) return;
    }

    if (draggingPointId) return; 
    
    if (!isAddMode) {
        setPdfNotification("Pro přidání bodu nejprve klikněte na tlačítko +");
        setTimeout(() => setPdfNotification(null), 3000);
        return;
    }

    if (!activeProject || !activePodlaziId || !mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const xPixels = (e.clientX - rect.left - transform.x) / transform.scale;
    const yPixels = (e.clientY - rect.top - transform.y) / transform.scale;

    const x = (xPixels / rect.width) * 100;
    const y = (yPixels / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    setNewPointCoords({ x, y });
    setFormData({ nazev: '', poznamka: '', foto: null });
    setIsAddMode(false);
    setCurrentView('form');
  };

  const handleFabClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newMode = !isAddMode;
      setIsAddMode(newMode);
      if (newMode) setPdfNotification("Režim vkládání aktivní: Klikněte na místo v mapě.");
      else setPdfNotification(null);
  };

  const handleSavePoint = () => {
    if (!activeProject || !activePodlaziId || !newPointCoords) return;

    const globalCount = body.filter(b => b.projectId === activeProject.id).length;

    const newBod: Bod = {
      id: Date.now().toString(),
      projectId: activeProject.id,
      podlaziId: activePodlaziId,
      cislo: globalCount + 1,
      nazev: formData.nazev || 'Nový bod',
      poznamka: formData.poznamka,
      x: newPointCoords.x,
      y: newPointCoords.y,
      foto: formData.foto
    };

    setBody([...body, newBod]);
    setCurrentView('dashboard');
    setNewPointCoords(null);
  };

  const movePointOrder = (index: number, direction: 'up' | 'down') => {
      if (!activeProject) return;
      
      const projectPoints = body.filter(b => b.projectId === activeProject.id).sort((a,b) => a.cislo - b.cislo);
      const otherPoints = body.filter(b => b.projectId !== activeProject.id);

      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === projectPoints.length - 1) return;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      const temp = projectPoints[index];
      projectPoints[index] = projectPoints[newIndex];
      projectPoints[newIndex] = temp;

      const reorderedProjectPoints = projectPoints.map((b, i) => ({
          ...b,
          cislo: i + 1
      }));

      setBody([...otherPoints, ...reorderedProjectPoints]);
  };

  const handleGeneratePDF = () => {
    if (!activeProject) return;
    setIsGeneratingPdf(true);
    setTimeout(() => {
        setIsGeneratingPdf(false);
        const fileName = `Report_${activeProject.nazev.replace(/\s+/g, '_')}.pdf`;
        setPdfNotification(`Soubor '${fileName}' byl uložen na Google Disk.`);
        setTimeout(() => setPdfNotification(null), 5000);
    }, 2000); 
  };

  const handleAddProject = (nazev: string, floors: {nazev: string, img: string}[]) => {
    const newProject: Projekt = {
      id: Date.now().toString(),
      nazev: nazev,
      status: 'Rozpracované',
      podlazi: floors.map((f, i) => ({
          id: `f-${Date.now()}-${i}`,
          nazev: f.nazev,
          imgUrl: f.img
      }))
    };
    setProjects([...projects, newProject]);
    setCurrentView('list');
  };

  // --- Helpers ---
  const getActiveFloor = () => {
      return activeProject?.podlazi.find(p => p.id === activePodlaziId);
  };

  // --- Pohľady ---

  const ProjectsView = () => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        onClick={() => setCurrentView('add-project')} 
        className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition border-2 border-dashed border-blue-300 flex flex-col items-center justify-center min-h-[200px] group"
      >
        <div className="bg-blue-50 p-4 rounded-full mb-2 group-hover:bg-blue-100 transition">
            <Plus size={32} className="text-blue-600" />
        </div>
        <span className="font-bold text-blue-700">Nový projekt</span>
      </div>

      {projects.map(p => (
        <div key={p.id} onClick={() => handleSelectProject(p)} className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition">
          <div className="h-40 bg-gray-200 flex items-center justify-center relative overflow-hidden">
             <Layers size={48} className="text-gray-400" />
             <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow">
                {p.podlazi.length} podlaží
             </div>
             <div className="absolute bottom-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow">
                {body.filter(b => b.projectId === p.id).length} bodů celkem
             </div>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-lg text-gray-800 truncate">{p.nazev}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'Rozpracované' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {p.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const DashboardView = () => {
    const allProjectPoints = body
        .filter(b => b.projectId === activeProject?.id)
        .sort((a,b) => a.cislo - b.cislo);

    const floorPoints = allProjectPoints.filter(b => b.podlaziId === activePodlaziId);
    
    const activeFloor = getActiveFloor();

    return (
      <div className="flex flex-col h-full overflow-hidden relative">
        {pdfNotification && (
            <div className={`absolute top-4 left-4 right-4 z-50 p-3 rounded shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300 ${pdfNotification.includes('tlačítko +') ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'}`}>
                <div className="flex items-center gap-2">
                    {pdfNotification.includes('tlačítko +') ? <MousePointer2 size={18}/> : <Check size={18} />}
                    <span className="text-sm font-medium">{pdfNotification}</span>
                </div>
                <button onClick={() => setPdfNotification(null)} className="text-white/80 hover:text-white"><X size={18}/></button>
            </div>
        )}

        <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto shadow-sm z-30">
            <Layers size={18} className="text-gray-500 shrink-0"/>
            <span className="text-sm font-bold text-gray-700 shrink-0">Podlaží:</span>
            <div className="flex gap-2">
                {activeProject?.podlazi.map(f => (
                    <button
                        key={f.id}
                        onClick={() => { setActivePodlaziId(f.id); setTransform({scale: 1, x:0, y:0}); setIsAddMode(false); }}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition ${activePodlaziId === f.id ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {f.nazev}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 bg-slate-200 relative overflow-hidden border-b-4 border-blue-600"
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
        >
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-white/90 p-2 rounded shadow-lg backdrop-blur">
            <button onClick={() => handleZoom(0.2)} className="p-2 hover:bg-gray-100 rounded" title="Přiblížit"><ZoomIn size={20}/></button>
            <button onClick={() => handleZoom(-0.2)} className="p-2 hover:bg-gray-100 rounded" title="Oddálit"><ZoomOut size={20}/></button>
            <div className="w-full h-px bg-gray-300 my-1"></div>
            <button onClick={handleResetView} className="p-2 hover:bg-gray-100 rounded" title="Reset"><Maximize size={20}/></button>
          </div>

          <div className={`absolute top-2 left-2 z-10 px-3 py-1.5 rounded text-sm font-semibold shadow-sm pointer-events-none flex items-center gap-2 transition-colors ${isAddMode ? 'bg-green-600 text-white' : 'bg-white/80 text-gray-800'}`}>
            {isAddMode ? (
                <> <MousePointer2 size={14} /> REŽIM VKLÁDÁNÍ: Klikněte na mapu ({activeFloor?.nazev}) </>
            ) : (
                <> <Move size={14} /> Posun: Táhněte myší | <MapPin size={14} /> Přesun bodu: Táhněte špendlíkem </>
            )}
          </div>
          
          <div 
            ref={mapContainerRef}
            className={`relative w-full h-full origin-top-left ${isDraggingMap ? 'cursor-grabbing' : (isAddMode ? 'cursor-crosshair' : 'cursor-grab')}`}
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transition: isDraggingMap || draggingPointId ? 'none' : 'transform 0.1s ease-out'
            }}
            onMouseDown={(e) => handleMouseDown(e)}
            onClick={handleMapClick}
          >
            {activeFloor?.imgUrl === 'svg' ? (
                <FloorPlanSVG label={activeFloor.nazev} />
            ) : (
                <img 
                    src={activeFloor?.imgUrl} 
                    alt="Půdorys" 
                    className="w-full h-full object-contain pointer-events-none select-none" 
                />
            )}
            
            {floorPoints.map((b) => (
              <div
                key={b.id}
                className="absolute transform -translate-x-1/2 -translate-y-full group/pin"
                style={{ left: `${b.x}%`, top: `${b.y}%`, cursor: isAddMode ? 'crosshair' : 'grab' }}
                onMouseDown={(e) => !isAddMode && handleMouseDown(e, b.id)}
                onClick={(e) => e.stopPropagation()} 
              >
                <MapPin 
                    className={`drop-shadow-md transition-colors ${draggingPointId === b.id ? 'text-blue-600 scale-125' : (isAddMode ? 'text-gray-400' : 'text-red-600 hover:text-red-700')}`} 
                    fill="currentColor"
                    size={32} 
                />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-1 rounded shadow-sm pointer-events-none">
                  {b.cislo}
                </span>
                
                {!draggingPointId && !isAddMode && (
                    <div className="hidden group-hover/pin:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-white text-gray-800 text-xs rounded p-2 shadow-xl z-20 text-center border pointer-events-none">
                        <div className="font-bold mb-1">{b.nazev}</div>
                    </div>
                )}
              </div>
            ))}
          </div>

          <button 
            className={`absolute bottom-4 right-4 text-white p-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition z-20 border-2 border-white ${isAddMode ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={handleFabClick}
            title={isAddMode ? "Zrušit vkládání" : "Přidat bod"}
          >
            {isAddMode ? <X size={24} /> : <Plus size={24} />}
          </button>
        </div>

        <div className="h-1/3 bg-white overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
          <div className="sticky top-0 bg-gray-100 p-2 border-b flex justify-between items-center z-10">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><List size={18}/> Seznam kontrolních bodů (Všechna podlaží)</h3>
            <button 
              onClick={handleGeneratePDF}
              disabled={isGeneratingPdf}
              className={`text-white px-3 py-1 rounded text-sm flex items-center gap-2 transition ${isGeneratingPdf ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isGeneratingPdf ? <Loader size={16} className="animate-spin" /> : <Printer size={16} />}
              {isGeneratingPdf ? 'Generuji...' : 'Export PDF'}
            </button>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-2 py-2 w-10 text-center">Poř.</th>
                <th className="px-4 py-2 w-12 text-center">#</th>
                <th className="px-4 py-2">Název</th>
                <th className="px-4 py-2">Podlaží</th>
                <th className="px-4 py-2">Poznámka</th>
                <th className="px-4 py-2 w-20 text-center">Foto</th>
              </tr>
            </thead>
            <tbody>
              {allProjectPoints.length === 0 ? (
                 <tr><td colSpan={6} className="text-center p-4 text-gray-500">Žiadne body v projektu</td></tr>
              ) : (
                allProjectPoints.map((b, index) => {
                  const floorName = activeProject?.podlazi.find(f => f.id === b.podlaziId)?.nazev || "Neznámé";
                  const isCurrentFloor = b.podlaziId === activePodlaziId;

                  return (
                  <tr key={b.id} className={`border-b ${isCurrentFloor ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50 text-gray-500'}`}>
                    <td className="px-2 py-2">
                        <div className="flex flex-col items-center gap-1">
                            <button onClick={() => movePointOrder(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                            <button onClick={() => movePointOrder(index, 'down')} disabled={index === allProjectPoints.length - 1} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                        </div>
                    </td>
                    <td className="px-4 py-2 font-medium text-center">{b.cislo}</td>
                    <td className="px-4 py-2">{b.nazev}</td>
                    <td className="px-4 py-2 text-xs font-semibold">{floorName}</td>
                    <td className="px-4 py-2 truncate max-w-[150px]">{b.poznamka}</td>
                    <td className="px-4 py-2 text-center text-blue-600">
                        {b.foto ? (
                            <img src={b.foto} alt="Foto" className="w-8 h-8 object-cover rounded border mx-auto bg-gray-100" />
                        ) : (
                            <Camera size={16} className="inline opacity-30"/>
                        )}
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const FormView = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFormData({ ...formData, foto: URL.createObjectURL(file) });
        }
    };
    
    const nextNumber = body.filter(b => b.projectId === activeProject?.id).length + 1;

    return (
    <div className="p-4 max-w-lg mx-auto bg-white min-h-full">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Nový Kontrolný Bod</h2>
      <div className="bg-blue-50 p-3 rounded mb-4 text-sm text-blue-800 flex items-center gap-2">
          <Layers size={16} />
          <span>Přidáváte bod do: <strong>{getActiveFloor()?.nazev}</strong></span>
      </div>

      <div className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Poradové číslo (Globální)</label><input type="text" disabled value={nextNumber} className="w-full p-2 bg-gray-100 border rounded" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Název kontrolního bodu *</label><input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formData.nazev} onChange={(e) => setFormData({...formData, nazev: e.target.value})} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Poznámka</label><textarea className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none h-24" value={formData.poznamka} onChange={(e) => setFormData({...formData, poznamka: e.target.value})} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Fotografia</label><input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />{formData.foto ? (<div className="relative"><img src={formData.foto} alt="Náhled" className="w-full h-48 object-cover rounded border" /><button onClick={() => setFormData({...formData, foto: null})} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"><Trash2 size={16}/></button></div>) : (<button onClick={() => fileInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-gray-300 rounded text-gray-500 flex flex-col items-center hover:bg-gray-50"><Camera size={32} /><span className="text-sm mt-1">Nahrať fotku alebo odfotiť</span></button>)}</div>
        <div className="pt-4 flex gap-3">
          <button onClick={() => { setCurrentView('dashboard'); setIsAddMode(false); }} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50">Zrušiť</button>
          <button onClick={handleSavePoint} className="flex-1 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 flex justify-center items-center gap-2"><Save size={18} /> Uložiť</button>
        </div>
      </div>
    </div>
    );
  };

  const AddProjectView = () => {
    const [name, setName] = useState('');
    const [floors, setFloors] = useState<{nazev: string, img: string}[]>([]);
    
    const [floorName, setFloorName] = useState('');
    const [floorImg, setFloorImg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) setFloorImg(URL.createObjectURL(file)); };

    const addFloor = () => {
        if (floorName && floorImg) {
            setFloors([...floors, { nazev: floorName, img: floorImg }]);
            setFloorName('');
            setFloorImg(null);
        }
    };

    const handleSave = () => { if (!name || floors.length === 0) return; handleAddProject(name, floors); };

    return (
        <div className="p-4 max-w-lg mx-auto bg-white min-h-full">
            <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Nový Projekt</h2>
            <div className="space-y-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Název projektu *</label><input type="text" className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Např. Bytový dům Karla Čapka" value={name} onChange={(e) => setName(e.target.value)}/></div>
                
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Seznam podlaží</label>
                    {floors.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                            <img src={f.img} className="w-10 h-10 object-cover rounded bg-white" alt="floor" />
                            <span className="flex-1 font-medium">{f.nazev}</span>
                            <button onClick={() => setFloors(floors.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {floors.length === 0 && <div className="text-sm text-gray-500 italic p-2">Zatím žádná podlaží. Přidejte alespoň jedno.</div>}
                </div>

                <div className="border p-4 rounded-lg bg-blue-50/50 space-y-3">
                    <h3 className="text-sm font-bold text-blue-800">Přidat nové podlaží</h3>
                    <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Název podlaží (např. 1.NP)" value={floorName} onChange={(e) => setFloorName(e.target.value)} />
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    
                    {floorImg ? (
                        <div className="relative h-24 bg-white border rounded flex items-center justify-center overflow-hidden">
                            <img src={floorImg} alt="Náhled" className="h-full object-contain" />
                            <button onClick={() => setFloorImg(null)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><X size={12}/></button>
                        </div>
                    ) : (
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-gray-300 rounded text-gray-500 flex flex-col items-center hover:bg-white text-xs">
                            <Upload size={20} className="mb-1" /> Nahrát půdorys
                        </button>
                    )}
                    
                    <button onClick={addFloor} disabled={!floorName || !floorImg} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Přidat podlaží do seznamu</button>
                </div>

                <div className="pt-4 flex gap-3"><button onClick={() => setCurrentView('list')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50">Zrušit</button><button onClick={handleSave} disabled={!name || floors.length === 0} className={`flex-1 py-3 text-white rounded font-medium flex justify-center items-center gap-2 ${(!name || floors.length === 0) ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}><Save size={18} /> Uložit projekt</button></div>
            </div>
        </div>
    );
  };

  return (
    <div className="h-screen w-full bg-gray-200 flex justify-center items-center font-sans">
      <div className="w-full h-full md:max-w-md bg-white md:shadow-2xl overflow-hidden flex flex-col relative">
        <header className="bg-blue-700 text-white p-4 flex items-center shadow-md z-20">
          {(currentView !== 'list') && (<button onClick={() => setCurrentView('list')} className="mr-3 hover:bg-blue-600 p-1 rounded-full"><ArrowLeft size={24} /></button>)}
          <h1 className="text-lg font-medium truncate flex-1">{currentView === 'list' ? 'Moje Projekty' : (currentView === 'add-project' ? 'Nový projekt' : activeProject?.nazev)}</h1>
          <button className="p-1"><FileText size={20} className="opacity-70" /></button>
        </header>
        <main className="flex-1 overflow-auto relative bg-white">{currentView === 'list' && <ProjectsView />}{currentView === 'add-project' && <AddProjectView />}{currentView === 'dashboard' && <DashboardView />}{currentView === 'form' && <FormView />}</main>
        {currentView === 'list' && (<nav className="bg-white border-t flex justify-around p-2 text-xs text-gray-500"><div className="flex flex-col items-center text-blue-700 font-bold cursor-pointer"><List size={24} /><span>Projekty</span></div><div className="flex flex-col items-center cursor-pointer"><MapIcon size={24} /><span>Mapa</span></div></nav>)}
      </div>
    </div>
  );
};

export default App;
