import React, { Dispatch, SetStateAction, useContext } from 'react';
import { TreeItem, removeNodeAtPath } from 'react-sortable-tree';
import { Device } from '../types/devices';
import { DevicesContext } from '../providers/DevicesProvider/DevicesProvider';
import { brkRef } from '../utils/common';
import { _createVerificationNodes, createNewTreeNode, createNewUnionNode, getAllDevicesByPeriod, getAvailableDevices, isTreeValid, makeFluxAnalisis, moveAllNodeChildrenToList, setActualUnionNodeValues } from '../service/deviceService';
import { getPeriodFromLocalStorage, getTreeDataFromLocalStorage, saveFluxAnalysisToLocalStorage, savePeriodToLocalStorage, saveTreeDataToLocalStorage } from '../service/localData';
/* import { MOCKED_DEVICES, MOCKED_DEVICES_1 } from '../constant/devices'; */
import { INVALID_TREE_DATA_ERROR } from 'constant/errors';
import { saveTreeOnInflux } from 'service/treeService';

interface IuseDevicesData {
  editing: boolean;
  devicesList: Device[];
  treeData: TreeItem[];
  fluxAnalisis: Array<Array<number | string>>;
  loadingDevices: boolean;
  loadingSaveConfig: boolean;
  updateTreeData: Dispatch<SetStateAction<TreeItem[]>>;
  updateDevicesList: Dispatch<SetStateAction<Device[]>>;
  updateFluxAnalisis: Dispatch<SetStateAction<Array<Array<number | string>>>>;
  moveToTree: (
    deviceIndex: number
  ) => void;
  createUnionNode: (
    value: number
  ) => void;
  moveToList: (
    treeNode: TreeItem,
    path: Array<number | string>,
    getNodeKeyCallBack: ({ treeIndex }: any) => any
  ) => void,
  analyseFlux: (
    treeData?: TreeItem[]
    //getNodeKeyCallBack: ({ treeIndex }: any) => any
  ) => void,
  setEditing: Dispatch<SetStateAction<boolean>>;
  setLoadingDevices: Dispatch<SetStateAction<boolean>>; 
  initData: () => Promise<void>;
  saveData: () => Promise<void>;
  //TODO: A scopo di test period è considerato any, da tipizzare con data di inizio e fine periodo
  currentPeriod: any;
  onPeriodChange: (period: any, treeData: TreeItem[]) => Promise<void>;
}

export default function useDevicesData(): IuseDevicesData {

  const { 
    editing,
    treeData,
    devicesList, 
    fluxAnalisis,
    currentPeriod,
    loadingDevices,
    loadingSaveConfig,
    setCurrentPeriod,
    updateDevicesList,
    updateFluxAnalisis,
    setLoadingDevices,
    setLoadingSaveConfig,
    updateTreeData,
    setEditing,
  } = useContext(DevicesContext);

  //TODO: per non usare l'index dell'array, capire se è il caso di gestire una proprità che identifica il device
  const moveToTree = React.useCallback((
    deviceIndex: number,
  ) => {
    const newTreeData: TreeItem[] = brkRef(treeData);
    const newDevicesList: Device[] = brkRef(devicesList);
    const deviceToBeMoved = newDevicesList.splice(deviceIndex, 1)[0];
    const treeNode = createNewTreeNode(deviceToBeMoved);
    newTreeData.push(treeNode); 
    updateDevicesList(newDevicesList);
    updateTreeData(newTreeData);
  }, [devicesList, treeData, updateDevicesList, updateTreeData]);

  const createUnionNode = React.useCallback((
    value: number
  ) => {
    const newTreeData: TreeItem[] = brkRef(treeData);
    const newUnionNode = createNewUnionNode(value);
    newTreeData.push(newUnionNode);
    updateTreeData(newTreeData);
  }, [treeData, updateTreeData])

  const moveToList = React.useCallback((
    treeNode: TreeItem,
    path: Array<number | string>,
    getNodeKeyCallBack: ({ treeIndex }: any) => any
  ) => {
    let newDevicesList: Device[] = brkRef(devicesList);
    moveAllNodeChildrenToList([treeNode], newDevicesList);
    const newTreeData = removeNodeAtPath({
      getNodeKey: getNodeKeyCallBack,
      treeData: treeData, 
      path: path, 
    });
    updateTreeData(newTreeData);
    updateDevicesList(newDevicesList);
  }, [treeData, devicesList, updateTreeData, updateDevicesList]);

  const analyseFlux = React.useCallback((
    _treeData?: TreeItem[]
  ) => {
    // creazione dei nodi differenza nell'albero
    // creazione analisi dei flussi per costruzione grafico sankey
    const a_treeData = _treeData || treeData;
    let newFlux = [["From", "To", "Weight"]];
    makeFluxAnalisis(a_treeData, newFlux);
    newFlux = newFlux.length === 1 ? [] : newFlux;
    saveFluxAnalysisToLocalStorage(newFlux);
    updateFluxAnalisis(newFlux);
    console.log('new flux', newFlux);
  }, [treeData, updateFluxAnalisis]);

  const saveData = React.useCallback(async () => {
    setLoadingSaveConfig(true);
    if (!isTreeValid(treeData)) {
      alert(INVALID_TREE_DATA_ERROR)
      return;
    }
    let newTreeData = brkRef(treeData) as TreeItem[];
    setActualUnionNodeValues(newTreeData);
    _createVerificationNodes(newTreeData);
    saveTreeDataToLocalStorage(newTreeData);
    savePeriodToLocalStorage(currentPeriod);
    updateTreeData(newTreeData);
    analyseFlux(newTreeData);
    await saveTreeOnInflux(newTreeData);
    setEditing(false);
    setLoadingSaveConfig(false);
  }, [treeData, currentPeriod, analyseFlux, setEditing, updateTreeData]);

  const _loadDevicesByPeriod = React.useCallback(async (
    _period: any
  ): Promise<any[]> => {
    setLoadingDevices(true);
    let from = new Date();
    from.setHours(from.getHours()-35064);
    let to = new Date();
    const devicesByPeriod = await getAllDevicesByPeriod(from, to, _period); // period aggiunto a scopo di test
    setLoadingDevices(false);
    return devicesByPeriod;
  }, [setLoadingDevices]);

  // la prop _treeData serve solo in fase di inizializzazione
  // senza di questa per vedere la struttura dell'albero bisognarebbe aspettare la chiamata sincrona del fetch dei disposotivi
  // serve quindi per visualizzare la struttura dell'albero locale prima della risposta dei dispositivi, in seguito alla quale si ricostruisce l'albero apportando modifiche se necessarie
  const onPeriodChange = React.useCallback(async(
    period: any,
    _treeData: TreeItem[]
  ): Promise<void> => {
    // 1. prendere periodo dal local storage
    // 2. getDevicesByPeriod col periodo preso dal local storage
    // 3. getAvailableDevices per ricostruzione dell'albero
    // 4. nuova analisi dei flussi (con nuova struttura albero con consumi aggiornati)
    //const devicesByPeriod = period === 1 ? MOCKED_DEVICES_1 : MOCKED_DEVICES;
    const devicesByPeriod = await _loadDevicesByPeriod(period);
    // l'albero, nonostante sia lo stesso a livello di struttura rispetto a quello precedentemente salvato, viene ricalcolato. Questo perchè 
    // i dispositivi che ritorna l'api potrebbero avere dei valori di consumo diversi. Di conseguenza se si usasse l'albero vecchio senza ricalcolo si 
    // vedrebbero gli stessi dispositivi con i valori di consumo vecchi (non aggiornati)
    const { devicesList, treeData: newTreeData } = getAvailableDevices(_treeData, devicesByPeriod);
    let newFluxAnalysis: Array<Array<number | string>> = [["From", "To", "Weight"]];
    makeFluxAnalisis(newTreeData, newFluxAnalysis);
    newFluxAnalysis = newFluxAnalysis.length === 1 ? [] : newFluxAnalysis;
    updateFluxAnalisis(newFluxAnalysis);
    updateDevicesList(devicesList);
    updateTreeData(newTreeData);
    setCurrentPeriod(period);
  }, [ 
    setCurrentPeriod, 
    updateDevicesList, 
    updateFluxAnalisis, 
    updateTreeData,
    _loadDevicesByPeriod,
  ]);

  const initData = React.useCallback(async() => {
    const localTreeData: TreeItem[] = getTreeDataFromLocalStorage();
    //TODO: A scopo di test period è considerato any, da tipizzare con data di inizio e fine periodo
    const period: any = getPeriodFromLocalStorage();
    await onPeriodChange(period, localTreeData);
  }, [onPeriodChange]);

  return {
    treeData,
    devicesList,
    fluxAnalisis,
    currentPeriod,
    loadingDevices,
    loadingSaveConfig,
    editing,
    initData,
    moveToTree,
    createUnionNode,
    updateTreeData,
    onPeriodChange,
    updateDevicesList,
    updateFluxAnalisis,
    setLoadingDevices,
    saveData,
    analyseFlux,
    moveToList,
    setEditing
  }
}
