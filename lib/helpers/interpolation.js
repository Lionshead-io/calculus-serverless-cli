export default function (fileString, data) {
    return fileString.replace(
        /%(\w*)%/g, // or /{(\w*)}/g for "{this} instead of %this%"
        function (m, key) {
            return data.hasOwnProperty(key) ? data[key] : "";
        }
    );
}