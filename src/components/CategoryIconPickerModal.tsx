import React from 'react';
import {View, Text, TouchableOpacity, Modal, FlatList} from 'react-native';

import AnatomicalHeart from '../assets/svg_icons/category_icons/anatomical-heart.svg';
import Bone from '../assets/svg_icons/category_icons/bone.svg';
import BrainCircuit from '../assets/svg_icons/category_icons/brain-circuit.svg';
import Cell from '../assets/svg_icons/category_icons/cell.svg';
import Ear from '../assets/svg_icons/category_icons/ear.svg';
import Flask from '../assets/svg_icons/category_icons/flask.svg';
import HeartBeatLine from '../assets/svg_icons/category_icons/heart-beat-line.svg';
import Heart from '../assets/svg_icons/category_icons/heart.svg';
import Lungs from '../assets/svg_icons/category_icons/lungs.svg';
import Wellbeing from '../assets/svg_icons/category_icons/wellbeing.svg';

export type CategoryIconKey =
  | 'anatomical-heart' | 'bone' | 'brain-circuit' | 'cell' | 'ear'
  | 'flask' | 'heart-beat-line' | 'heart' | 'lungs' | 'wellbeing';

const ICONS: {key: CategoryIconKey; label: string}[] = [
  {key: 'anatomical-heart', label: 'Heart'},
  {key: 'bone',             label: 'Bone'},
  {key: 'brain-circuit',    label: 'Brain'},
  {key: 'cell',             label: 'Cell'},
  {key: 'ear',              label: 'Ear'},
  {key: 'flask',            label: 'Flask'},
  {key: 'heart-beat-line',  label: 'ECG'},
  {key: 'heart',            label: 'Cardio'},
  {key: 'lungs',            label: 'Lungs'},
  {key: 'wellbeing',        label: 'Wellbeing'},
];

export function CategoryIcon({iconKey, size = 24, color = '#14B8A6'}: {iconKey: CategoryIconKey; size?: number; color?: string}) {
  const props = {width: size, height: size, color};
  switch (iconKey) {
    case 'anatomical-heart': return <AnatomicalHeart {...props} />;
    case 'bone':             return <Bone {...props} />;
    case 'brain-circuit':    return <BrainCircuit {...props} />;
    case 'cell':             return <Cell {...props} />;
    case 'ear':              return <Ear {...props} />;
    case 'flask':            return <Flask {...props} />;
    case 'heart-beat-line':  return <HeartBeatLine {...props} />;
    case 'heart':            return <Heart {...props} />;
    case 'lungs':            return <Lungs {...props} />;
    case 'wellbeing':        return <Wellbeing {...props} />;
  }
}

interface Props {
  visible: boolean;
  selected: CategoryIconKey;
  onSelect: (key: CategoryIconKey) => void;
  onClose: () => void;
}

export default function CategoryIconPickerModal({visible, selected, onSelect, onClose}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <Text className="text-gray-800 font-bold text-base mb-1">Choose Icon</Text>
            <Text className="text-gray-400 text-xs mb-4">More icons coming soon</Text>
            <FlatList
              data={ICONS}
              keyExtractor={item => item.key}
              numColumns={5}
              scrollEnabled={false}
              renderItem={({item}) => {
                const isSelected = selected === item.key;
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(item.key); onClose(); }}
                    className="flex-1 items-center py-3"
                    style={{maxWidth: '20%'}}>
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center mb-1"
                      style={{backgroundColor: isSelected ? '#CCFBF1' : '#F3F4F6'}}>
                      <CategoryIcon iconKey={item.key} size={24} color={isSelected ? '#14B8A6' : '#6B7280'} />
                    </View>
                    <Text className={`text-xs ${isSelected ? 'text-teal-500 font-semibold' : 'text-gray-400'}`}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
