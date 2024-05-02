import React from 'react';
import { Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import SortableTree, { ExtendedNodeData, TreeItem, changeNodeAtPath } from 'react-sortable-tree';
import useDevicesData from '../../hooks/useDevicesData';
import './styles.css'
import MeasurementPointDialog from '../Form/MeasurementPointDialog';
import { brkRef } from '../../utils/common';
import { saveDeviceToLocalStorage } from '../../service/localData';

const TREE_ITEM_HEIGHT = 90;
const TREE_ITEM_TITLE_HEIGHT = 30;

const DevicesTreeView: React.FC = () => {
  
  const {
    editing,
    treeData,
    updateTreeData,
    moveToList,
  } = useDevicesData();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedNode, setSelectedNode] = React.useState<{
    node: TreeItem,
    path: Array<number | string>
  } | null>(null);
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  
  const onToggleMenuClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    selNode: TreeItem,
    path: Array<number | string>,
  ): void => {
    setAnchorEl(event.currentTarget);
    setSelectedNode({node: selNode, path});
  }

  const handleMenuClose = () => {
    setAnchorEl(null);
  }
  
  const getNodeKey = ({treeIndex}: any) => treeIndex;

  const onTreeNodeDelete = (
    treeNode: TreeItem,
    path: Array<number | string>
  ) => {
    moveToList(treeNode, path, getNodeKey);
  }

  const onModalOpen = (): void => {
    setModalOpen(true);
  }

  const onModalClose = (): void => {
    setModalOpen(false);
    setAnchorEl(null);
  }

  // TODO: attualmente salva solo il nome del nodo, da gestire per tutti le altre input
  const onModalSubmit = (customName: string) => {
    console.log('CUSTOM NAME', customName);
    const nodePath = selectedNode?.path as Array<number | string>;
    const newNode = brkRef(selectedNode?.node) as TreeItem;
    newNode.metadata.customName = customName;
    const newTree = changeNodeAtPath({
      treeData, 
      path: nodePath,
      newNode: newNode,
      ignoreCollapsed: true, 
      getNodeKey
    });
    saveDeviceToLocalStorage(newNode);
    updateTreeData(newTree);
    onModalClose();
  }

  const renderNotAvailableDot = () => (
    <Stack 
      zIndex={10}
      position={'absolute'}
      top={8} right={8} 
      width={15} height={15}
      borderRadius={15}
      bgcolor={/* '#FA6C6C' */'red'} />
  )

  const CardItem = (nodeData: ExtendedNodeData) => {
    const { node, path } = nodeData;
    return (
      <Stack
        p={2}
        display={'flex'}
        position={'absolute'}
        flexDirection={'row'}
        top={0} bottom={0} left={0} right={0}
        justifyContent={'space-between'}
        bgcolor={'transparent'}>
          { !node.metadata.available && renderNotAvailableDot() }
          <Stack 
            position={'absolute'}/>
          <Stack
            position={'absolute'}
            top={0} left={0} right={0}
            borderBottom={'1px solid grey'}
            borderRadius={'0px 15px 0px 0px'}
            height={TREE_ITEM_TITLE_HEIGHT}
            bgcolor={'lightblue'}>
              <Typography 
                fontWeight={700}
                color={
                  !node.metadata.available 
                    ? 'red' 
                    : node.metadata.type === 'diff' 
                      ? 'orange' 
                      : 'black'
                }
                textAlign={'center'}>
                  {node.metadata.customName ?? node.title}
              </Typography>
          </Stack>
          <Stack
            paddingLeft={1}
            paddingRight={1}
            display={'flex'}
            bgcolor={'white'}
            position={'absolute'}
            alignItems={'center'}
            flexDirection={'row'}
            justifyContent={'space-between'}
            borderRadius={'0px 0px 15px 0px'}
            top={TREE_ITEM_TITLE_HEIGHT}
            bottom={0} left={0} right={0}>
              <Typography>{node.metadata.value} kw/h</Typography>
              <Button
                fullWidth={false}
                disabled={!editing || node.metadata.type === 'diff'}
                sx={{height: '30px', width: '50px', marginLeft: 'auto', marginBottom: 'auto', marginTop: 'auto'}} 
                onClick={() => onTreeNodeDelete(node, path)}>
                  <Typography textTransform={'none'}>del</Typography>
              </Button>
              <Button
                fullWidth={false}
                disabled={!editing || node.metadata.type === 'diff'}
                sx={{height: '30px', width: '50px', marginLeft: 'auto', marginBottom: 'auto', marginTop: 'auto'}} 
                onClick={(e) => onToggleMenuClick(e, node, path)}>
                  <Typography textTransform={'none'}>menu</Typography>
              </Button>
          </Stack>
      </Stack>
    )
  }

  return (
    <Box p={3} 
      m={3} 
      bgcolor={'lightgrey'}
      minHeight={'100vh'}
      flex={0.7}>
      {/* <Button onClick={() => analyseFlux()}>
        <Typography>ANALIZZA</Typography>
      </Button> */}
      {
        treeData.length > 0 && 
          <SortableTree
            style={{minHeight: '50vh'}}
            treeData={treeData}
            getNodeKey={getNodeKey}
            canDrop={(d) => {
              if (!editing) {
                return false;
              }
              const parentNode = d.nextParent;
              // non posso posizionare nodi come figli di nodi verifica
              if (parentNode && parentNode.metadata.type === 'diff') {
                return false;
              }
              // non posso spostare direttamente nodi verifica
              return d.node.metadata.type !== 'diff';
            }}
            rowHeight={TREE_ITEM_HEIGHT}
            onChange={newTreeData => updateTreeData(newTreeData)}
            generateNodeProps={(nodeData: ExtendedNodeData)=>({
              title: CardItem(nodeData)
            })}
          />
      }
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        sx={{marginLeft: 2, overflow: 'visible'}}
        anchorOrigin={{vertical: 'center', horizontal: 'right'}}
        transformOrigin={{vertical: 'center', horizontal: 'left'}}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
      >
        <MenuItem onClick={onModalOpen}>Edit</MenuItem>
      </Menu>
      <MeasurementPointDialog 
        onSave={onModalSubmit}
        open={modalOpen}
        nodeData={selectedNode}
        onClose={onModalClose} />
    </Box>
  );
};

export default DevicesTreeView;