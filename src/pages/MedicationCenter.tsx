import React from "react";
import SmartMedAIHub from "../components/SmartMedAIHub";
import { UserProfile } from "../types";

export default function MedicationCenter({ user }: { user: UserProfile }) {
  return <SmartMedAIHub user={user} />;
}
