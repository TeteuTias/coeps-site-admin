"use client"
import { getSession } from "@auth0/nextjs-auth0/edge"
import { ObjectId } from "bson"


export default async function getUserIdServerSide(): Promise<ObjectId> {
    const user = await getSession()
    if (!user || !user.user.sub) {
        throw new Error("!user.user.sub")
    }
    const sub = user.user.sub as string
    return new ObjectId(sub.replace("auth0|", ""))
}