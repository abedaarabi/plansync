export async function webStreamToBuffer(stream) {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (value)
            chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
