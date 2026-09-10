import React from 'react';
import {TouchableOpacity, Text, View} from 'react-native';
import Plus from '../assets/svg_icons/plus.svg';
interface FloatingAddButtonProps {
  onPress: () => void;
}

export default function FloatingAddButton({onPress}: FloatingAddButtonProps) {
  return (
    <TouchableOpacity
            className=" absolute bottom-5 right-5 bg-[#14B8A6] w-[80px] h-[80px] rounded-full p-5 flex-col items-center justify-center elevation-4 shadow-black shadow-opacity-20 shadow-radius-4
            "
          >
            {/* Add icon placeholder */}
            <Plus width={25} height={25} color='white'/>
            <Text className="text-white font-semibold text-4">Add</Text>
          </TouchableOpacity>
  );
}
