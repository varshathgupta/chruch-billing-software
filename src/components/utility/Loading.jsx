import { Flex, Text } from "@chakra-ui/react";
import React from "react";
import { PropagateLoader } from "react-spinners";

function Loading({ loading }) {
  return (
    <Flex h={"100vh"} w={"100vw"} alignItems={"center"} flexDir={"column"}>
      <Text
        textColor={"teal.500"}
        fontSize={{ base: "3xl", md: "6xl" }}
        mt={"25vh"}
        mb={"4rem"}
      >
        ExpenseCare
      </Text>
      <PropagateLoader
        color="teal"
        loading={loading}
        size={20}
        aria-label="Loading Spinner"
        data-testid="loader"
      />
    </Flex>
  );
}

export default Loading;
